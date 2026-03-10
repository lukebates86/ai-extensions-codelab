/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const defaultTransactions = [
	{ merchant: "Apple Store", amount: 129.99, type: "debit", time: "Today" },
	{ merchant: "Payroll", amount: 2250.0, type: "credit", time: "Yesterday" },
	{ merchant: "Coffee House", amount: 6.75, type: "debit", time: "Yesterday" },
];

let transactions = [...defaultTransactions];

const cardForm = document.querySelector("#cardForm");
const transactionForm = document.querySelector("#transactionForm");
const transactionList = document.querySelector("#transactionList");
const balanceDisplay = document.querySelector("#balanceDisplay");

const cardNameDisplay = document.querySelector("#cardNameDisplay");
const cardNumberDisplay = document.querySelector("#cardNumberDisplay");
const cardExpiryDisplay = document.querySelector("#cardExpiryDisplay");

const formatCurrency = (value) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(value);

const maskCardNumber = (value) => {
	const digitsOnly = value.replace(/\D/g, "").slice(0, 16);
	if (!digitsOnly) return "•••• •••• •••• 1234";
	const maskedPrefix = "•".repeat(Math.max(digitsOnly.length - 4, 0));
	const visibleDigits = digitsOnly.slice(-4);
	const combined = `${maskedPrefix}${visibleDigits}`;
	return combined.padStart(16, "•").match(/.{1,4}/g).join(" ");
};

const calculateBalance = () =>
	transactions.reduce(
		(balance, transaction) =>
			transaction.type === "credit"
				? balance + transaction.amount
				: balance - transaction.amount,
		1200
	);

const renderTransactions = () => {
	transactionList.innerHTML = "";
	transactions.forEach((transaction) => {
		const item = document.createElement("li");
		item.className = "transaction-item";
		item.innerHTML = `
			<div class="transaction-item__meta">
				<p class="transaction-item__merchant">${transaction.merchant}</p>
				<p class="transaction-item__time">${transaction.time}</p>
			</div>
			<p class="transaction-item__amount ${transaction.type}">
				${transaction.type === "debit" ? "-" : "+"}${formatCurrency(transaction.amount)}
			</p>
		`;
		transactionList.append(item);
	});

	balanceDisplay.textContent = `Balance: ${formatCurrency(calculateBalance())}`;
};

cardForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const cardName = document.querySelector("#cardName").value.trim();
	const cardNumber = document.querySelector("#cardNumber").value.trim();
	const cardExpiry = document.querySelector("#cardExpiry").value.trim();

	if (cardName) cardNameDisplay.textContent = cardName;
	if (cardNumber) cardNumberDisplay.textContent = maskCardNumber(cardNumber);
	if (cardExpiry) cardExpiryDisplay.textContent = cardExpiry;
	cardForm.reset();
});

transactionForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const merchant = document.querySelector("#merchant").value.trim();
	const amountValue = Number(document.querySelector("#amount").value);
	const type = document.querySelector("#type").value;

	if (!merchant || !Number.isFinite(amountValue) || amountValue <= 0) return;

	transactions = [
		{ merchant, amount: amountValue, type, time: "Just now" },
		...transactions,
	];

	transactionForm.reset();
	renderTransactions();
});

renderTransactions();
