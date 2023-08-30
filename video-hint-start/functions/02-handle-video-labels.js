import { onObjectFinalized } from "firebase-functions/v2/storage";
import logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const IS_TEST_MODE = process.env.NEXT_PUBLIC_IS_TEST_MODE === "true";

if (IS_TEST_MODE) {
	logger.warn("⚠️ Running in test mode");
}

function parseJsonLabelsToCsv(json) {
	if (!json?.annotation_results?.length) {
		logger.error("No annotation_results found in JSON, skipping");
		return;
	}

	const csvArray = json.annotation_results.map(result =>
		result.shot_label_annotations
			.map(annotation => {
				const { description } = annotation.entity;
				return annotation.segments
					.map(segment => {
						const start = segment.segment.start_time_offset.seconds;
						const end = segment.segment.end_time_offset.seconds;
						return `${start},${end},${description}`;
					})
					.join("\n");
			})
			.join("\n")
	);

	return ["start_seconds,end_seconds,detected_label", ...csvArray].join("\n");
}

function generatePromptFromVideoLabels(csv) {
	const fullPrompt = `Here are the label detection results for a video. The results are in CSV. Based on the labels, describe to me at a high-level, what the video might show in sequential order. Keep your response to three short sentences: \n"""\n${csv}\n"""\nDon't tell me what the video is about, just say What you think can be seen in the video:`;
	return fullPrompt;
}

function removeFileExtension(filePath = "", extension = "") {
	return filePath.replace(extension, "");
}

async function downloadCloudStorageFile(fileBucket, filePath) {
	const bucket = getStorage().bucket(fileBucket);
	const downloadResponse = await bucket.file(filePath).download();
	return downloadResponse;
}

/*
	Step 2 in the extension pipeline: Process the video labels file which was generated by the storage-label-videos extension
*/
export const handleVideoLabels = onObjectFinalized(async ({ data }) => {
	const functionName = "Handle Video Labels:";
	logger.info(`${functionName} Starting`);
	const filePath = data.name;

	if (!filePath.endsWith(".json")) {
		logger.info(
			`${functionName} Video labels file is not a json file, skipping: "${filePath}"`
		);
		return;
	}

	logger.info(`${functionName} Processing file: "${filePath}"`);
	let jsonVideoLabels;

	try {
		const file = await downloadCloudStorageFile(data.bucket, filePath);
		jsonVideoLabels = JSON.parse(file.toString());
	} catch (error) {
		logger.error(
			`${functionName} Error: Could not download and parse the video labels JSON file`,
			error
		);
		return;
	}

	const csvVideoLabels = parseJsonLabelsToCsv(jsonVideoLabels);

	if (!csvVideoLabels || !csvVideoLabels?.length) {
		logger.info(
			`${functionName} Couldn't convert the video labels to CSV, skipping`
		);
		return;
	}

	const fullPrompt = generatePromptFromVideoLabels(csvVideoLabels);

	const sourceFilePath = removeFileExtension(filePath, ".json").replace(
		"video_annotation_output",
		"video_annotation_input"
	);

	const querySnapshot = await getFirestore()
		.collection("bot")
		.where("file", "==", sourceFilePath)
		.get();

	if (querySnapshot.empty) {
		logger.info(
			`${functionName} No Firestore document found for file: "${filePath}"`
		);
		return;
	}

	const [{ id: docId }] = querySnapshot.docs;

	await getFirestore().collection("bot").doc(docId).update({
		input: fullPrompt,
		// The prompt is ready, so we can now allow the firestore-palm-gen-text extension to process this document by resetting the status
		status: null,
	});
	logger.info(
		`${functionName} Finished: Prompt generated and saved to Firestore`
	);
	return;
});
