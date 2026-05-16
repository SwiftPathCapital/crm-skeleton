import { useState, useCallback } from "react";

// ─────────────────────────────────────────────
// SHARED STYLES (CSS-in-JS via style tags)
// ─────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap');`;

// ─────────────────────────────────────────────
// LIVE TRANSFER DATA
// ─────────────────────────────────────────────
const LT_SECTIONS = [
  { title: "Opener", sub: "Step 1 of 8" },
  { title: "Re-Confirm Quals", sub: "Step 2 of 8" },
  { title: "The Pitch", sub: "Step 3 of 8" },
  { title: "Doc Request", sub: "Step 4A of 8" },
  { title: "Sending Links", sub: "Step 4B of 8" },
  { title: "Live Walkthrough", sub: "Step 4C of 8" },
  { title: "Commitment", sub: "Step 4D of 8" },
  { title: "Final Hand-off", sub: "Step 5 of 8" },
];

const LT_QUALS = [
  { id: "q1", num: "01", label: "Time in business", question: "\"And the business has been operating under the current EIN for how long?\"", why: "Synergy minimum: 6 months.", passLabel: "✓ 6+ months", failLabel: "✗ Under 6 months", dqReason: "Under 6 months is a hard Synergy DQ — does not meet the minimum criteria they sold you on." },
  { id: "q2", num: "02", label: "Monthly deposits", question: "\"On average, what are total monthly deposits going into the business account?\"", why: "Synergy minimum: $15,000/month.", passLabel: "✓ $15k+/month", failLabel: "✗ Under $15k/month", dqReason: "Under $15k/month is a hard Synergy DQ." },
  { id: "q3", num: "03", label: "FICO", question: "\"Where is your FICO sitting roughly?\"", why: "Synergy minimum: 500+.", passLabel: "✓ 500+", failLabel: "✗ Under 500", dqReason: "Under 500 FICO is a hard Synergy DQ." },
  { id: "q4", num: "04", label: "BK / defaults / judgments", question: "\"There are no open bankruptcies, defaults, or judgments currently?\"", why: "Synergy screens for this — but recent filings get missed. Confirm directly.", passLabel: "✓ None", failLabel: "✗ Active BK / default / judgment", dqReason: "Active BK, default, or judgment is a hard Synergy DQ." },
  { id: "q5", num: "05", label: "Funding timeline", question: "\"You're looking to have this in the account within the next 30 days?\"", why: "Synergy minimum: requesting funding within 30 days.", passLabel: "✓ Within 30 days", failLabel: "✗ Beyond 30 days", dqReason: "Beyond 30 days is a hard Synergy DQ — not actively seeking funding." },
  { id: "q6", num: "06", label: "Business bank account", question: "\"And you do have a dedicated business bank account?\"", why: "Synergy minimum: must have a business bank account.", passLabel: "✓ Yes", failLabel: "✗ No business account", dqReason: "No business bank account is a hard Synergy DQ." },
  { id: "q7", num: "07", label: "Existing positions & use of funds", question: "\"Do you have any open loans or MCA positions right now? And the use of funds — [Synergy use] — is that still the plan?\"", why: "Not a hard DQ — capture count and total balance. Use of funds affects funder matching.", passLabel: "✓ Confirmed", warnLabel: "⚠ Heavy MCA stack", warnReason: "Heavy MCA stack — note the count and total balance, flag for management. Continue with the call.", hasWarn: true },
];

const LT_OBJECTIONS = [
  { cat:"trust", label:"Trust", color:"#5b9cf6", q:"\"Who are you and why am I talking to you instead of getting funded directly?\"", r:`"Great question — and the honest answer is that going directly to one lender is exactly what limits your options.\n\nSwift Path sits in front of 50-plus institutional and private funders. Our job is to submit your profile across all of them at once and use those relationships to push terms in your favor before we bring anything to you. You could go direct to one lender and take what they give you — or you can let us run competition on your behalf.\n\nThat's the difference."`, tip:"Frame Swift Path as the advantage, not the middleman. Competition across funders is the product." },
  { cat:"trust", label:"Trust", color:"#5b9cf6", q:"\"I've never heard of Swift Path Capital.\"", r:`"We're not a household name — we work through the funding network and by referral, which is how we keep overhead low enough to negotiate better terms for clients.\n\n$600 million in facilitated business capital across 50-plus institutional and private funders and lenders. What matters isn't the name on the door — it's what we can do with your file. And you're on this call because Synergy flagged you as a strong match for what we do."`, tip:"The Synergy transfer itself is a credibility signal — they were vetted before getting to you." },
  { cat:"trust", label:"Trust", color:"#5b9cf6", q:"\"This sounds like a scam / I've been burned by funding companies before.\"", r:`"I hear you — and frankly that's a smart thing to say in this space because there are bad actors out there.\n\nHere's what I can tell you about how we work: no upfront fees, no wiring money to anyone, no sharing account credentials. You sign an application authorizing us to submit your file, you upload bank statements to a secure portal, and then our underwriting team works the network on your behalf. You don't commit to anything until you've seen an actual offer and decided it works for your business.\n\nWhat specifically happened before? It'll help me make sure we're not heading in the same direction."`, tip:"Ask what happened. It disarms the objection and tells you exactly what to avoid — and what to contrast against." },
  { cat:"trust", label:"Trust", color:"#5b9cf6", q:"\"How do I know this is secure?\"", r:`"That's exactly why I'm sending portal links instead of asking you to email documents or read anything over the phone. Bank-grade encrypted upload portal — our own junior staff can't access your data. Everything goes straight to the Underwriting vault."`, tip:"Portal vs. email is the security distinction. Make it concrete." },
  { cat:"trust", label:"Trust", color:"#5b9cf6", q:"\"How do I know you won't misuse my bank statements?\"", r:`"Bank statements don't contain what someone would need to open accounts or take out loans in your name — no full SSN, no login credentials. They're read-only transaction history and deposit patterns.\n\nThe signed application is a separate legal record of your consent — it documents exactly what you authorized us to do on your behalf. That protects you as much as it enables us."`, tip:"Answer specifically. Explaining what bank statements do and don't contain defuses this faster than reassurance." },
  { cat:"rescreen", label:"Re-Screen", color:"#f5a623", q:"\"I already gave all this information — why are you asking again?\"", r:`"I know — and I appreciate your patience. The intake gets us the baseline, but our underwriting team needs to confirm a few things directly before we can route your file to the right funders. It's a 2-minute check that makes sure we're not wasting your time or ours by submitting you to programs that aren't the right fit.\n\nI promise it's the last time."`, tip:"Frame re-confirmation as thoroughness on their behalf, not distrust of their answers." },
  { cat:"rescreen", label:"Re-Screen", color:"#f5a623", q:"\"The person I talked to already said I was approved.\"", r:`"They cleared the intake criteria — which is great, it means you're in the right range. What I'm doing is the Pre-Underwriting step, which is where we match you to the specific funders in our network that are the best fit for your profile. That requires a quick confirmation on a few details so we route you correctly.\n\nIt's not a second approval — it's the step that makes the first one actually mean something."`, tip:"Don't contradict Synergy. Reframe your step as what converts the intake approval into a real submission." },
  { cat:"delay", label:"Delay", color:"#f5a623", q:"\"I'm just shopping around / not ready to move yet.\"", r:`"That's fair — and I'd rather you be in the right headspace than push you into something you're not ready for.\n\nHere's the thing: the submission itself doesn't cost you anything and doesn't commit you to any offer. What it does is get your profile in front of the network so you have real numbers to compare against whatever else you're looking at. You can't shop effectively without knowing what you actually qualify for.\n\nLet's get your file in — if the offers don't work, you walk away with better information than you had before."`, tip:"Turn shopping into an asset — their comparison process needs your offers to be useful." },
  { cat:"delay", label:"Delay", color:"#f5a623", q:"\"I need to talk to my partner / accountant first.\"", r:`"Makes total sense. Let me get the links sent to you now so you have something concrete to show them — the application lays out the full process and the portal is where the statements go. When you sit down together you'll have the actual framework in front of you.\n\nIf they have questions, have them reach out directly. I'm happy to walk them through it."`, tip:"Get the links sent before they get off the phone. Something in their inbox beats a verbal explanation every time." },
  { cat:"delay", label:"Delay", color:"#f5a623", q:"\"I'm really busy — can you call me back?\"", r:`"I can do that. Just want to be straight about what changes — right now your file is active and your review slot is open. If I call back later I'm starting fresh and can't guarantee the same availability or the same terms framework.\n\nThe links I'm sending take about 4 minutes once you're in front of your docs. Is there any chance you've got 4 minutes today, even after hours?"`, tip:"Attach a real cost to the delay. Lower the time barrier to 4 minutes." },
  { cat:"delay", label:"Delay", color:"#f5a623", q:"\"Just email me the information.\"", r:`"The links are already headed to your phone — those are the information. The application and the secure upload portal, everything pre-populated from your intake.\n\nAn email about our process doesn't move your file. Getting into the system does. The links get you in the queue today."`, tip:"The links are the information. Make that concrete." },
  { cat:"qualify", label:"Qualify", color:"#f06060", q:"\"My revenue is actually lower than what I put on the form.\"", r:`"I appreciate you being straight with me — that's more helpful than finding out later.\n\nDepending on how much lower, it may shift which funders are the best match, but it doesn't necessarily close the door. Walk me through what the actual monthly deposits look like and I'll tell you honestly where we stand."`, tip:"Don't react — get the real number and reassess. Honesty on a live call is rare, reward it with a real answer." },
  { cat:"qualify", label:"Qualify", color:"#f06060", q:"\"I have more MCA positions than I listed.\"", r:`"Okay — I'd rather know that now than have it come back on the file later.\n\nWhat's the count and roughly what's the total balance across all of them?"`, tip:"Capture the count and total balance accurately and move on — management will determine direction from the documents." },
  { cat:"qualify", label:"Qualify", color:"#f06060", q:"\"My FICO is actually below 500.\"", r:`"Appreciate the honesty. Below 500 does narrow the network — most of the standard programs have a floor there.\n\nWhat it shifts us toward is revenue-based underwriting, where the funders are looking at your cash flow and deposit consistency rather than the score. If your monthly deposits are strong and consistent, there's still a path — it just routes through different funders. Let me finish confirming the rest of the picture before I tell you what we're working with."`, tip:"Revenue-based funders are the pivot. Get the full picture before drawing any conclusions." },
  { cat:"competitor", label:"Competitor", color:"#40c4a0", q:"\"I'm already working with another funding company.\"", r:`"Not a problem — and I'm not going to ask you to drop them.\n\nThe difference is the simultaneous submission model. Most companies work one or two lenders at a time. We run your file across the full network at once — competing offers in the same window. Even if the other company comes through, you'd want to know whether their offer was actually competitive or just the first thing on the table.\n\nAre they actively working your file right now or is it more of a waiting situation?"`, tip:"Position simultaneous submission as information they need regardless of the other company." },
  { cat:"competitor", label:"Competitor", color:"#40c4a0", q:"\"I already have an offer — I'm just taking it.\"", r:`"Good — that means your file is fundable.\n\nBefore you sign: do you know if that offer came through a full network submission or just one or two lenders? If it was limited, there's a real chance we can beat it or at minimum confirm you're getting a fair rate.\n\nFour minutes to get your file in front of our network. If our number is worse you sign theirs and lose nothing. If it's better, you've saved real money. Worth 4 minutes?"`, tip:"Frame it as a price check, not a competition." },
  { cat:"terms", label:"Terms", color:"#a78bfa", q:"\"What are your rates?\"", r:`"Straight answer: I don't have your rate yet and neither does anyone else at this point.\n\nRates are built off your actual cash flow, deposit history, existing positions, and which funders compete for your file. That's what our underwriting team constructs before they bring a number to you — not a ballpark, real negotiated figures.\n\nIf I quoted you a rate right now I'd be making something up. The model is built so competition across 50-plus funders drives the rate as low as the market will go for your specific profile."`, tip:"Reframe the rate question as proof the process works on their behalf." },
  { cat:"terms", label:"Terms", color:"#a78bfa", q:"\"I only want monthly payments, not daily or weekly.\"", r:`"Legitimate preference — it narrows the pool but doesn't close it.\n\nThere are term loan structures in the network that run on monthly ACH. They typically need a cleaner credit profile and stronger bank statements, but they exist. Let me flag your file as term-loan preferred and let the network tell us what comes back on that schedule."`, tip:"Payment structure preferences are routing decisions, not disqualifiers." },
  { cat:"docs", label:"Doc Request", color:"#f5a623", docOnly:true, q:"\"Why do you need my bank statements before I talk to anyone?\"", r:`"Because the review without the statements is just a conversation — it has no numbers behind it.\n\nThe statements are what our underwriting team uses to build your funding profile, position you competitively across the network, and push for better terms. Without them we're submitting a profile with no backbone and coming back to you with generic offers instead of negotiated ones.\n\nThe 2-hour window between when your docs hit and your review — that's where the actual work happens."`, tip:"The review without docs is a lesser product. Make that concrete." },
  { cat:"docs", label:"Doc Request", color:"#f5a623", docOnly:true, q:"\"I'm not sending my bank statements to someone I just got transferred to.\"", r:`"That's a completely reasonable position — and I want to be clear about what's happening.\n\nYou're not sending them to me. I'm giving you a link to a bank-grade encrypted upload portal that goes directly to our Underwriting vault. I don't see your statements. Our junior staff doesn't see them. They go straight to the underwriting team's review only.\n\nWe built it that way specifically because of what you just said."`, tip:"The portal vs. sending-to-you distinction is real and it matters. Make it concrete." },
  { cat:"docs", label:"Doc Request", color:"#f5a623", docOnly:true, q:"\"What are you going to do with my bank statements?\"", r:`"Straight answer: our underwriting team uses them to build your funding profile — cash flow, average daily balance, deposit consistency. That's the leverage used to position your file and negotiate terms across the network.\n\nOnce the review is complete the documents stay in the Underwriting vault. Not sold, not shared outside the network, not used for anything beyond getting you the best terms possible."`, tip:"Answer directly and specifically. Vague answers on this kill trust fast." },
  { cat:"friction", label:"Friction", color:"#40c4a0", frictionOnly:true, q:"\"I don't know how to get my bank statements as a PDF.\"", r:`"I'll walk you through it right now — takes about 60 seconds.\n\nLog into your online banking, go to Accounts, find your business checking, look for Statements or Documents, and download each month as a PDF. Which bank are you with? I can tell you exactly where it is."`, tip:"Get the bank name and walk them through it live." },
  { cat:"friction", label:"Friction", color:"#40c4a0", frictionOnly:true, q:"\"I only have paper statements.\"", r:`"That works. Two options: iPhone Notes app or Google Drive on Android both have a built-in scanner that turns a photo into a clean PDF automatically. Or you can switch to e-statements in your online banking and download the last few months right there.\n\nI'll hold right here — usually takes 3-4 minutes once you know where to look."`, tip:"Two options, stay on the line. Files go cold when you hang up." },
  { cat:"friction", label:"Friction", color:"#40c4a0", frictionOnly:true, q:"\"The portal isn't working / link won't open.\"", r:`"Don't close out of it. Open it in a browser — Chrome or Safari — not just previewing in your texts. Copy the link and paste it directly into the browser bar.\n\nIf it's still not loading I'll resend a fresh link right now. What device are you on?"`, tip:"Stay on the line and treat it as your problem. Technical friction kills files." },
  { cat:"pushback", label:"Pushback", color:"#f06060", q:"\"This feels like a lot of steps.\"", r:`"I get it — and I want to be straight about why it's set up this way.\n\nThe review isn't a discovery call where someone learns about your business. By the time our underwriting team comes to you they've already submitted your profile across the network and worked the terms. The steps you're doing right now are what make that possible.\n\nIf you just want someone to tell you what might be available, that's easy to find. What's harder is someone who already has competing offers worked before you say hello. That's what this process delivers."`, tip:"Reframe the steps as the product, not the barrier." },
  { cat:"pushback", label:"Pushback", color:"#f06060", q:"\"I'll just go directly to a lender.\"", r:`"You can — and if one lender gives you a competitive rate and moves fast, take it.\n\nHere's what changes: one lender underwrites to their box and their rates. No competition, no negotiation. If you don't fit, you're done. We run your file across 50-plus simultaneously — competition between them is what moves the rate.\n\nIs going direct a real option you're actively pursuing, or more of a fallback?"`, tip:"Find out if it's real or a deflection. The last question surfaces that." },
  { cat:"pushback", label:"Pushback", color:"#f06060", q:"\"I need to think about it.\"", r:`"Fair — what specifically is giving you pause? If it's the documents, the process, or the timeline those are things I can address right now.\n\nIf it's something else I'd rather know — I don't want to hold a review slot for a file that isn't moving, and you don't want to lose your spot if you decide to proceed.\n\nWhat's the piece that needs more clarity?"`, tip:"Surface the real objection. 'I need to think about it' is never the actual issue." },
];

function getLTObjsForSection(idx) {
  return LT_OBJECTIONS.filter(o => {
    if (o.docOnly && idx < 3) return false;
    if (o.frictionOnly && idx < 4) return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// WEBFORM DATA
// ─────────────────────────────────────────────
const WF_SECTIONS = [
  { title: "Opener", sub: "Step 1 of 7" },
  { title: "Verbal Audit", sub: "Step 2 of 7" },
  { title: "Approval & Docs", sub: "Step 3A of 7" },
  { title: "Sending Links", sub: "Step 3B of 7" },
  { title: "Live Walkthrough", sub: "Step 3C of 7" },
  { title: "Commitment", sub: "Step 3D of 7" },
  { title: "Final Hand-off", sub: "Step 4 of 7" },
];

const WF_AUDIT = [
  { num:"01", label:"Time in business", question:"\"How long has the business been operating under the current EIN?\"", note:null },
  { num:"02", label:"Monthly revenue", question:"\"On average, what are your total monthly deposits going into the business account?\"", note:null },
  { num:"03", label:"Existing positions", question:"\"Do you currently have any open business loans or active MCA positions right now?\"", note:"If yes → \"How many open positions do you have, and roughly what's the total balance across all of them?\" — capture both count AND total balance. Heavy stack = route to debt relief angle in objections." },
  { num:"04", label:"Credit range", question:"\"Where is your FICO sitting roughly? We only use soft-pulls for the pre-review, so just a ballpark is fine.\"", note:null },
  { num:"05", label:"Use of funds", question:"\"If the Director clears you for an allocation, what is the specific project or use for these funds?\"", note:null },
  { num:"06", label:"Timeline", question:"\"And when is the target date you need this capital in the account?\"", note:null },
];

const WF_OBJECTIONS = {
  opener: [
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"I've never heard of Swift Path Capital.\"", r:`"We're not a household name — we work through the funding network and by referral, which is actually how we keep overhead low enough to negotiate better terms for our clients.\n\nYou came to us because you're looking for capital — the reason that request landed on our desk is the Director's network. $600 million in facilitated capital, 50-plus institutional and private funders and lenders. What matters isn't the name on the door — it's what he can get done for your file. And the only way to see that is to get your file in front of him."`, tip:"They submitted the form — they already expressed interest. Use that as the anchor instead of defending the brand from scratch." },
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"This sounds like a scam.\"", r:`"I get it — there's a lot of noise in this space and it's smart to be cautious. But think about what actually happened here: you filled out a request for business capital, and we're following up on it. We came to you because you raised your hand.\n\nAnd I'm not asking you to wire anything, pay upfront, or hand over account credentials. All I'm doing is running a quick verbal audit to confirm you hit the benchmarks. If you do, I send two links — a pre-filled application and a secure upload portal. No money moves until you've seen an actual offer and decided it works for you.\n\nYou're not committing to anything — you're committing to a conversation you already started."`, tip:"The form submission is your credibility anchor. They initiated — lean on that to reframe the skepticism." },
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"Can I look you guys up first before I do anything?\"", r:`"Absolutely, take a look — SwiftPathCapital.net. Everything about how we work is right there.\n\nWhile you're pulling that up I'll go ahead and send the two links so they're waiting for you. The application and upload portal will be in your texts — nothing activates until you decide to move forward. I just don't want you to lose your place in the review queue if you do decide to proceed.\n\nWhat's the best number to send those to?"`, tip:"Direct them to the site only. Get the links sent while they're looking so the process stays warm." },
  ],
  audit: [
    { tag:"qualify", tagLabel:"Qualify", color:"#f5a623", q:"\"We only do about $5,000 a month in deposits.\"", r:`"I appreciate you being straight with me. At $5,000 a month the standard allocation programs aren't going to be the right fit — the minimums start higher.\n\nWhat I can do is flag your file for our growth-stage funders. Smaller network, but specifically structured for businesses that are building up — lower amounts, lower thresholds.\n\nBefore I route it that way — is $5,000 a recent number or has it been consistent? Sometimes there's a seasonal dip or a recent shift that changes the picture."`, tip:"Don't hard-close a low-revenue lead. Reframe to a lower-tier product and probe for context." },
    { tag:"qualify", tagLabel:"Qualify", color:"#f5a623", q:"\"The business is only 2 months old.\"", r:`"Most of the standard programs require at least 6 months, sometimes a year — I want to be upfront about that.\n\nTwo things worth exploring: if you have a strong personal credit profile there are hybrid programs that blend business and personal underwriting for early-stage companies. And if you have prior business history under a different EIN, that experience factors in too.\n\nAre either of those true? If so, this might not be as closed as it looks."`, tip:"Early-stage businesses often have other angles — personal credit bridges and prior business history are the two fastest to probe." },
    { tag:"credit", tagLabel:"Credit", color:"#f06060", q:"\"My credit is really bad — under 500.\"", r:`"I appreciate you being upfront — and it doesn't automatically disqualify you.\n\nA lot of the programs in the Director's network are revenue-based, which means they're underwriting your cash flow, not your credit score. The FICO is one input, not the whole picture. I've seen files with sub-500 scores get approved when the monthly deposits were strong and the business had real history.\n\nLet me finish the audit on the other benchmarks. If your revenue and time in business hold up, I can flag this as a cash-flow-primary file and route it to the funders and lenders built for exactly that situation."`, tip:"Don't dismiss bad credit — pivot toward revenue-based products and keep the audit moving." },
    { tag:"credit", tagLabel:"Credit", color:"#f06060", q:"\"I just filed for bankruptcy.\"", r:`"I'm not going to pretend that doesn't affect the options, because it does.\n\nThe question is timing. If it was discharged more than 12 months ago and the business has been generating consistent deposits since then, there are lenders in the network who specifically work post-bankruptcy. They're looking at the recovery story, not just the filing.\n\nWhen was it discharged, and roughly what have your monthly deposits looked like the last few months? That tells me right away whether there's a path here or whether we need to revisit in a few months."`, tip:"Get the timeline. Discharge date and current revenue are what determine if any path exists." },
    { tag:"mca", tagLabel:"MCA Stack", color:"#f06060", q:"\"I have too much MCA debt already / I'm stacked.\"", r:`"I hear you — and honestly, that's exactly why I'm glad you picked up.\n\nOne of the things we specialize in — and most funding companies don't — is partnering directly with attorney services that work specifically on MCA positions. What they do is intervene on your existing agreements and typically get your weekly or daily payments reduced by up to 50%. And in most cases they're able to get the total balance settled down by up to 40%.\n\nSo before we even talk about new capital, we may be able to clean up what's already sitting on your plate and get you some breathing room. That's a conversation worth having with the Director — he handles both sides. Are you still operating and generating revenue right now?"`, tip:"Flips a dead lead into a two-product conversation. The closing question re-qualifies without restarting the audit." },
    { tag:"privacy", tagLabel:"Privacy", color:"#5b9cf6", q:"\"I don't want to give my revenue over the phone.\"", r:`"Totally understand — I'm not asking for exact numbers. I just need a ballpark monthly average so I know which funding tier to slot your file into and which of the Director's institutional and private funders and lenders you'd actually qualify for. Without a baseline I can't match you to the right programs."`, tip:"Keep it low-stakes. Ballpark is all you need — you're not auditing them, you're qualifying them." },
  ],
  approval: [
    { tag:"process", tagLabel:"Process", color:"#a78bfa", q:"\"Why do you need my bank statements before I even talk to the Director?\"", r:`"Because the whole value of talking to him is that he already has real numbers.\n\nIf you get on a call without the statements, he can't have submitted your file to the network yet, which means he has no offers, no competing rates, nothing to negotiate with. You'd just be getting a conversation — which any broker can give you for free.\n\nThe statements are what let him go to his 50-plus funders and lenders before you say hello and come back to you with actual numbers he's already worked. That 2-hour window between when your docs hit and when you talk to him — that's where the real work happens."`, tip:"Reframe the doc request as what makes the Director's call valuable. Without it, the call has nothing behind it." },
    { tag:"process", tagLabel:"Process", color:"#a78bfa", q:"\"Can't the Director just call me first and then I'll decide if I want to send anything?\"", r:`"I hear you — and if it were just a consultation call, that's exactly how it would work.\n\nBut his model isn't a consultation. By the time he gets on the phone with you he's already submitted your profile to every funders and lender you qualify for and negotiated the rates down. The call isn't him learning about your business — it's him presenting what he's already built for you.\n\nIf he calls you cold with nothing in hand, he's just another voice on the phone. The statements are what turn that call into something worth your time."`, tip:"The Director's value is pre-call preparation. Make that concrete — the call without the docs is a completely different, lesser product." },
    { tag:"privacy", tagLabel:"Privacy", color:"#5b9cf6", q:"\"I'm not sending my bank statements to someone I just met.\"", r:`"That's a completely reasonable position — and I want to be clear about what's actually happening here.\n\nYou're not sending them to me. I'm giving you a link to a bank-grade encrypted upload portal that goes directly to the Underwriting vault. I never see your statements. Our junior staff never sees them. They go straight to the Director for his review only — the same way you'd upload documents to your own bank's portal.\n\nThe reason we built it that way is exactly because of what you just said. People submitting financial documents deserve security, not an email attachment. Does that make more sense?"`, tip:"Separate 'sending to you' from 'uploading to a secure portal.' The distinction is real and it matters to them." },
    { tag:"privacy", tagLabel:"Privacy", color:"#5b9cf6", q:"\"What are you going to do with my bank statements?\"", r:`"Straight answer: the Director uses them to build your funding profile.\n\nThe statements show your actual cash flow, your average daily balance, your deposit consistency — that's the leverage he uses when he submits your file to the funders and lenders network and negotiates your rates down. Without them he's going in blind, and a blind submission gets generic offers, not negotiated ones.\n\nOnce the review is complete and you've been presented with offers, the documents stay in the Underwriting vault. They're not sold, not shared outside the network, not used for anything beyond getting you the best terms possible."`, tip:"Answer directly. Vague answers on this question kill trust fast — be specific about exactly how the statements are used." },
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"How do I know you won't use my statements to open accounts in my name?\"", r:`"That's a serious concern and I want to address it directly.\n\nBank statements don't contain the information needed to open accounts or take out loans — they don't have your full SSN, they don't have your account login credentials, and they're read-only documents. What they contain is transaction history and deposit patterns, which is exactly what lenders use to evaluate cash flow.\n\nThe signed application is a separate document — and it's a legal record of your consent to apply through this process. It actually protects you, because it documents exactly what you authorized and what we're authorized to do on your behalf. Nothing more."`, tip:"This fear is specific — answer it specifically. Explaining what bank statements do and don't contain defuses it better than reassurance alone." },
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"How do I know this is secure?\"", r:`"That's exactly why I'm sending portal links instead of asking you to email documents or read anything over the phone. The portals are bank-grade encrypted — even our junior staff can't access your data. Everything goes straight to the Underwriting vault for the Director's review only."`, tip:"The portal vs. email distinction is your security story. Make it concrete." },
  ],
  links: [
    { tag:"delay", tagLabel:"Delay", color:"#f5a623", q:"\"I need to talk to my partner / spouse / accountant first.\"", r:`"That makes total sense — this is a business decision and you shouldn't be making it solo.\n\nHere's what I'd suggest: the links are already on their way to your phone so you have something concrete to show them. When you sit down together you'll have the actual process and terms framework in front of you, not just my word for it. That usually makes the conversation a lot faster.\n\nIf they have questions after looking it over, have them reach out directly — I'm happy to walk them through it."`, tip:"Don't fight the third party — make them an ally. The links are already sent so the file keeps moving." },
    { tag:"delay", tagLabel:"Delay", color:"#f5a623", q:"\"Just email me the information and I'll look it over.\"", r:`"The links are already headed to your phone — those are the information. It's the pre-filled application and the secure upload portal, everything populated from what you submitted.\n\nA PDF about our process doesn't move your file. What moves it is getting your profile in front of the Director's network, and that only happens once the docs are in the system.\n\nIf we push this to email follow-ups we're starting over in two weeks. The links get you in the queue today."`, tip:"They already gave you their info on the form — make the links feel like the natural continuation, not a new ask." },
    { tag:"delay", tagLabel:"Delay", color:"#f5a623", q:"\"Why can't you just send the link and I'll do it later?\"", r:`"The links are already on their way to you right now. The only thing that creates the urgency is the 2-hour window — the Director needs that time to work his funders and lenders before the call. So whenever you're ready to sit down with it, it's there. And if you hit anything in the portal just text me directly and I'll walk you right through it."`, tip:"Acknowledge the flexibility, anchor the 2-hour window, and position yourself as support." },
    { tag:"pushback", tagLabel:"Pushback", color:"#f06060", q:"\"This feels like a lot of steps just to get a phone call.\"", r:`"I understand why it feels that way — and I want to be straight with you about why it's set up like this.\n\nThe call with the Director isn't a discovery call. By the time you're on the phone with him he's already submitted your file across his network and negotiated your rates. The 'steps' you're doing right now are what make that possible.\n\nIf you just want a phone call with someone who'll tell you what might be possible, that's easy to get anywhere. What's harder to get is someone who already has competing offers in hand before you say hello. That's what the process is built to deliver."`, tip:"Reframe the steps as the product, not the barrier to the product." },
  ],
  walkthrough: [
    { tag:"friction", tagLabel:"Friction", color:"#40c4a0", q:"\"I don't know how to get my bank statements as a PDF.\"", r:`"No problem at all — I'll walk you through it right now, it takes about 60 seconds.\n\nMost banks have it in the same place: log into your online banking, go to 'Accounts,' find your business checking, and look for a tab that says 'Statements' or 'Documents.' From there you can download each month as a PDF. Which bank are you with? I can tell you exactly where to find it."`, tip:"Get their bank name and walk them through it live — this is a 60-second fix, don't let it lose the file." },
    { tag:"friction", tagLabel:"Friction", color:"#40c4a0", q:"\"I only have paper statements, I don't have PDFs.\"", r:`"That works too — a couple of options.\n\nIf you have a smartphone you can use the Notes app on iPhone or Google Drive on Android — both have a built-in document scanner that turns a photo into a clean PDF automatically. Just scan each statement page and save.\n\nOr if you'd rather, most banks will let you switch to e-statements and download the last few months right from your online account. Either way I can hold right here while you pull them together — it usually takes about 3-4 minutes once you know where to look."`, tip:"Give them two options and offer to stay on the line. Hanging up to 'figure it out' is where files go cold." },
    { tag:"friction", tagLabel:"Friction", color:"#40c4a0", q:"\"The upload portal isn't working / I can't get the link to open.\"", r:`"Let's get that sorted right now — don't close out of it.\n\nFirst, make sure you're opening it in a browser, not just previewing it in your texts. Copy the link and paste it directly into Chrome or Safari. If it's still not loading, I can resend the link fresh — sometimes the first send gets filtered.\n\nWhat device are you on? I'll walk you right through it."`, tip:"Technical friction is a file-killer. Stay on the line, troubleshoot live, and treat it like it's your problem to solve — because it is." },
    { tag:"trust", tagLabel:"Trust", color:"#f5a623", q:"\"I've heard stories about funding companies stealing your identity with your docs.\"", r:`"I've heard those stories too — and some of them are real, which is why it's smart to ask.\n\nHere's the difference: those situations almost always involve someone asking you to email documents, photograph your checks, or share login credentials. We don't do any of that. The upload portal is bank-grade encrypted, documents go directly to the Underwriting vault, and the only person with access is the Director.\n\nYou submitted a request on our site. We followed up. The process from here is entirely through secure portals — not email, not text attachments, not anything that could be intercepted. That's not an accident, it's by design."`, tip:"Validate the concern, then contrast your process specifically against the risky behaviors they've heard about." },
  ],
  close: [
    { tag:"competitor", tagLabel:"Competitor", color:"#40c4a0", q:"\"I'm already working with another broker / funding company.\"", r:`"Not unusual — and I'm not going to ask you to drop them.\n\nThe difference is the simultaneous submission model. Most brokers shop your file to one or two lenders at a time. The Director submits to every funders and lender you qualify for at once — you get a full-market read and competing offers in the same window, not sequentially over weeks.\n\nEven if the other company comes through, you'd know whether their offer was actually competitive or just the first thing on the table. That information alone has real value.\n\nAre they actively working your file right now or is it more of a waiting-to-hear-back situation?"`, tip:"Don't attack the competitor. Position simultaneous submission as something the other broker structurally can't offer." },
    { tag:"competitor", tagLabel:"Competitor", color:"#40c4a0", q:"\"I already got an offer from another company and I'm going to take it.\"", r:`"Good — that means your file is fundable.\n\nQuick gut check before you sign: do you know if that offer came through a full-market submission or just one or two lenders? If it was limited, there's a real chance the Director can beat it — or at minimum confirm you're getting a fair rate.\n\nFour minutes to get your file in front of him. If his number is worse you take the other offer and you've lost nothing. If it's better you've saved real money. Worth 4 minutes to find out?"`, tip:"Reframe as a price check, not a competition. The 4-minute close is low-friction enough to work on an almost-decided prospect." },
    { tag:"terms", tagLabel:"Terms", color:"#a78bfa", q:"\"What are your rates? I'm not doing anything until I know the rates.\"", r:`"Fair — and I'll give you a straight answer: I don't have your rate yet, and neither does anyone else at this point.\n\nRates aren't generic — they're built off your actual cash flow, deposit history, existing positions, and which funders and lenders in the network compete for your file. That's exactly what the Director constructs before the call. He doesn't come to you with a ballpark — he comes with real numbers he's already negotiated down.\n\nIf I quoted you a rate right now I'd be making something up. The whole point of the model is using competition across 50-plus funders and lenders to drive the rate as low as the market will go for your specific profile."`, tip:"Don't dodge the rate question — reframe it as proof that the process actually works on their behalf." },
    { tag:"terms", tagLabel:"Terms", color:"#a78bfa", q:"\"I don't want a daily or weekly payment. I need monthly.\"", r:`"That's a legitimate preference and it narrows the pool — but it doesn't close it.\n\nThere are term loan structures in the Director's network that run on monthly ACH instead of daily factor pulls. They typically require a higher credit threshold and a cleaner bank statement, but they exist.\n\nLet me flag your file as term-loan preferred and let the Director identify which lenders can work on that schedule. If the monthly options don't come back competitive, you'll know exactly why and what it would take to get there. Does that work?"`, tip:"Payment structure preferences are workable constraints, not deal-killers. Route to the right product lane." },
    { tag:"pushback", tagLabel:"Pushback", color:"#f06060", q:"\"I'll just go to my bank instead.\"", r:`"That's always an option — and if your bank can move fast enough and offer you a competitive rate, you should take it.\n\nHere's what's typically different: banks underwrite to their own criteria and their own rates. There's no competition, no negotiation, and if you don't fit their box you're done. The Director's model runs your file across 50-plus institutional and private funders simultaneously — the competition between them is what drives the rate down.\n\nMost of our clients have already been to their bank, or know their bank won't move fast enough. Is that the situation here, or is the bank genuinely still on the table for you?"`, tip:"Don't dismiss the bank — find out if it's a real option or a deflection. The last question surfaces that." },
    { tag:"pushback", tagLabel:"Pushback", color:"#f06060", q:"\"I need to think about it.\"", r:`"Completely fair — what specifically is giving you pause? Because if it's the documents, the timeline, or the process itself, those are things I can address right now.\n\nIf it's something else, I'd rather know so I'm not sending you links that aren't going to move forward. The last thing I want to do is take up a slot in the Director's queue with a file that isn't going anywhere — and the last thing you want is to lose your spot if you do decide to move.\n\nWhat's the piece that needs more clarity?"`, tip:"Never let 'I need to think about it' end the call. Surface the real objection and handle that instead." },
    { tag:"delay", tagLabel:"Delay", color:"#f5a623", q:"\"I'm really busy right now, can you call me back next week?\"", r:`"I can do that — I just want to be straight with you about what changes.\n\nRight now your file is active, your benchmarks are cleared, and I can lock your slot in the Director's review queue today. If I call back next week I'm starting the audit over from scratch and I can't guarantee the same slot or the same terms framework — the funding landscape shifts week to week.\n\nYou submitted that request because you need capital. That need doesn't get easier if we push it out. The two links take about 4 minutes if you're in front of your phone — is there any chance you've got 4 minutes later today, even after hours?"`, tip:"Remind them they initiated the request. Attach a real cost to the delay, then lower the time barrier." },
  ],
};

// ─────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────

function ObjCard({ obj }) {
  const [open, setOpen] = useState(false);
  const color = obj.color || "#f5a623";
  return (
    <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:8, marginBottom:8, overflow:"hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", cursor:"pointer", transition:"background 0.15s", background: open ? "#1c1f23" : "transparent" }}
        onMouseEnter={e => e.currentTarget.style.background="#1c1f23"}
        onMouseLeave={e => e.currentTarget.style.background= open ? "#1c1f23" : "transparent"}
      >
        <span style={{ fontSize:10, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", padding:"3px 7px", borderRadius:3, whiteSpace:"nowrap", flexShrink:0, marginTop:1, color, border:`1px solid ${color}44`, background:"rgba(255,255,255,0.04)" }}>
          {obj.label || obj.tagLabel}
        </span>
        <span style={{ fontSize:13, fontWeight:500, color:"#f0f0ee", flex:1, lineHeight:1.5 }}>{obj.q}</span>
        <span style={{ color:"#5a5d5f", fontSize:18, flexShrink:0, marginTop:1, transition:"transform 0.2s", transform: open ? "rotate(90deg)" : "none", lineHeight:1 }}>›</span>
      </div>
      {open && (
        <div style={{ padding:"0 14px 14px", borderTop:"1px solid #2a2d32" }}>
          <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.8, paddingTop:12, whiteSpace:"pre-line" }}>{obj.r}</div>
          <div style={{ fontSize:12, color:"#5a5d5f", marginTop:10, padding:"8px 10px", background:"#1c1f23", borderRadius:6, borderLeft:"2px solid #353a40", fontFamily:"'DM Mono', monospace" }}>💡 {obj.tip}</div>
        </div>
      )}
    </div>
  );
}

function ObjSection({ title, objs, filterable = false }) {
  const [filter, setFilter] = useState("all");
  if (!objs || objs.length === 0) return null;
  const cats = filterable ? ["all", ...new Set(objs.map(o => o.cat || o.tag))] : null;
  const labelMap = { trust:"Trust", rescreen:"Re-Screen", delay:"Delay", qualify:"Qualify", competitor:"Competitor", terms:"Terms", docs:"Doc Request", friction:"Friction", pushback:"Pushback", process:"Process", privacy:"Privacy", credit:"Credit", mca:"MCA Stack" };
  const filtered = filterable && filter !== "all" ? objs.filter(o => (o.cat || o.tag) === filter) : objs;

  return (
    <div style={{ marginTop:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: filterable ? 10 : 16 }}>
        <span style={{ fontSize:filterable ? 11 : 13, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{title || "Objections"}</span>
        <div style={{ flex:1, height:1, background:"#2a2d32" }} />
      </div>
      {filterable && cats && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ fontSize:11, padding:"4px 10px", borderRadius:20, border:`1px solid ${filter===c?"#f0a060":"#353a40"}`, background: filter===c ? "rgba(240,160,96,0.06)" : "transparent", color: filter===c ? "#f0a060" : "#5a5d5f", cursor:"pointer", fontFamily:"'Syne', sans-serif", fontWeight:600, transition:"all 0.15s" }}>
              {c === "all" ? "All" : (labelMap[c] || c)}
            </button>
          ))}
        </div>
      )}
      {filtered.map((o, i) => <ObjCard key={i} obj={o} />)}
    </div>
  );
}

function NavButtons({ onBack, onNext, backLabel, nextLabel, onRestart }) {
  const btnBase = { padding:"10px 20px", borderRadius:6, fontFamily:"'Syne', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", border:"1px solid #353a40", background:"#1c1f23", color:"#9a9d9e", transition:"all 0.15s" };
  const btnPrimary = { ...btnBase, background:"#f0a060", color:"#0e0f11", borderColor:"#f0a060" };
  return (
    <div style={{ display:"flex", gap:10, marginTop:32, paddingBottom:48 }}>
      {onBack && <button style={btnBase} onClick={onBack} onMouseEnter={e=>{e.currentTarget.style.color="#f0f0ee";e.currentTarget.style.borderColor="#9a9d9e"}} onMouseLeave={e=>{e.currentTarget.style.color="#9a9d9e";e.currentTarget.style.borderColor="#353a40"}}>{backLabel || "← Back"}</button>}
      {onNext && <button style={btnPrimary} onClick={onNext} onMouseEnter={e=>{e.currentTarget.style.background="#d4823e"}} onMouseLeave={e=>{e.currentTarget.style.background="#f0a060"}}>{nextLabel || "Next →"}</button>}
      {onRestart && <button style={btnPrimary} onClick={onRestart} onMouseEnter={e=>{e.currentTarget.style.background="#d4823e"}} onMouseLeave={e=>{e.currentTarget.style.background="#f0a060"}}>↺ Start Over</button>}
    </div>
  );
}

function ScriptBlock({ label, labelColor, children, note }) {
  return (
    <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color: labelColor || "#f0a060" }}>{label}</span>
      </div>
      <div style={{ padding:16, fontSize:14, lineHeight:1.9, color:"#f0f0ee" }}>{children}</div>
      {note && <div style={{ padding:"12px 16px", fontSize:13, lineHeight:1.7, color:"#9a9d9e", fontStyle:"italic", borderLeft:"2px solid #353a40", margin:"0 16px 16px", borderRadius:"0 4px 4px 0" }}>{note}</div>}
    </div>
  );
}

function SectionHeader({ badge, title, desc, accentColor }) {
  const acc = accentColor || "#f0a060";
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"inline-flex", alignItems:"center", background:`${acc}1a`, border:`1px solid ${acc}40`, color:acc, fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", padding:"4px 10px", borderRadius:4, marginBottom:12 }}>{badge}</div>
      <div style={{ fontSize:24, fontWeight:700, color:"#f0f0ee", lineHeight:1.2, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:14, color:"#9a9d9e", lineHeight:1.6 }}>{desc}</div>
    </div>
  );
}

function Em({ children }) {
  return <span style={{ color:"#f0a060", fontStyle:"normal", fontWeight:600 }}>{children}</span>;
}

// ─────────────────────────────────────────────
// LIVE TRANSFER SCRIPT
// ─────────────────────────────────────────────
function LiveTransferScript({ agent }) {
  const [step, setStep] = useState(0);
  const [qualState, setQualState] = useState({});
  const [dqId, setDqId] = useState(null);
  const [agentInfo, setAgentInfo] = useState({ name: agent?.full_name || "", number:"", appUrl:"", uploadUrl:"" });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ name: agent?.full_name || "", number:"", appUrl:"", uploadUrl:"" });

  const markQual = useCallback((id, result) => {
    const newState = { ...qualState, [id]: result };
    setQualState(newState);
    if (result === "fail") {
      setDqId(id);
    } else {
      if (dqId) {
        const hardQuals = ["q1","q2","q3","q4","q5","q6"];
        const anyFail = hardQuals.some(q => newState[q] === "fail");
        if (!anyFail) setDqId(null);
      }
    }
  }, [qualState, dqId]);

  const resetQuals = () => { setQualState({}); setDqId(null); };

  const hardQuals = ["q1","q2","q3","q4","q5","q6"];
  const allAnswered = hardQuals.every(q => qualState[q]);
  const anyFail = hardQuals.some(q => qualState[q] === "fail");
  const allPass = allAnswered && !anyFail;

  const DQ_REASONS = {
    q1:"DQ reason: Under 6 months in business — does not meet Synergy minimum.",
    q2:"DQ reason: Under $15,000/month in deposits — does not meet Synergy minimum.",
    q3:"DQ reason: FICO under 500 — does not meet Synergy minimum.",
    q4:"DQ reason: Active bankruptcy, default, or judgment — Synergy explicitly excludes this.",
    q5:"DQ reason: Not seeking funding within 30 days — does not meet Synergy minimum.",
    q6:"DQ reason: No business bank account — does not meet Synergy minimum.",
  };

  const accentOrange = "#f0a060";

  const qualItemStyle = (id) => {
    const s = qualState[id];
    if (s === "pass") return { borderLeft:"2px solid #c8f060", paddingLeft:10 };
    if (s === "fail") return { borderLeft:"2px solid #f06060", paddingLeft:10, opacity:0.7 };
    if (s === "warn") return { borderLeft:"2px solid #f5a623", paddingLeft:10 };
    return {};
  };

  const qualBtnStyle = (id, type) => {
    const s = qualState[id];
    const base = { fontSize:12, fontWeight:600, fontFamily:"'Syne', sans-serif", padding:"5px 12px", borderRadius:5, cursor:"pointer", border:"1px solid #353a40", background:"#1c1f23", color:"#5a5d5f", transition:"all 0.15s" };
    if (type === "pass" && s === "pass") return { ...base, borderColor:"#c8f060", color:"#c8f060", background:"rgba(200,240,96,0.08)" };
    if (type === "fail" && s === "fail") return { ...base, borderColor:"#f06060", color:"#f06060", background:"rgba(240,96,96,0.08)" };
    if (type === "warn" && s === "warn") return { ...base, borderColor:"#f5a623", color:"#f5a623", background:"rgba(245,166,35,0.08)" };
    return base;
  };

  const sections_content = [
    // 0: Opener
    <div>
      <SectionHeader badge="Step 01" title="The Opener" desc="They've been prepped and transferred — hold them while you pull up their Synergy data sheet." />
      <div style={{ background:"rgba(240,96,96,0.07)", border:"1px solid rgba(240,96,96,0.25)", borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, color:"#f06060", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Before you speak</div>
        <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6 }}>Synergy sends the qualification sheet the moment the call connects. Have your screen ready — you're buying 60–90 seconds during the opener to pull it up before you get into re-confirmation.</div>
      </div>
      <ScriptBlock label="Opening Script" labelColor={accentOrange} note="That last question does two things: it buys you the final seconds to pull up the Synergy sheet, and it gets them talking in their own words — which almost always surfaces more than the intake form captured.">
        Hey <Em>[Name]</Em>, welcome to Swift Path Capital — I'm <Em>[Your Name]</Em> on the Pre-Underwriting desk, glad you're on the line.<br/><br/>
        Real quick before we dive in — Swift Path is a business capital intermediary. What that means is we don't lend out of one box. We work with a network of over 50 institutional and private funders and lenders, and our job is to match your business profile to the right capital source at the best available terms — not just the first approval we can get you, but the right one.<br/><br/>
        We've facilitated over $600 million in business capital, and the reason businesses come through us is because we run their profile across multiple funders simultaneously. That competition is what gets rates down and options up.<br/><br/>
        Now — I do have some information in front of me from the intake, but I want to make sure we're working off the right picture. So bring me up to speed — <Em>what has you looking for funding right now?</Em>
      </ScriptBlock>
      <ObjSection title="Objections" objs={getLTObjsForSection(0)} filterable={true} />
      <NavButtons onNext={() => setStep(1)} nextLabel="Next: Re-Confirm Quals →" />
    </div>,

    // 1: Re-Confirm Quals
    <div>
      <SectionHeader badge="Step 02" title="Re-Confirm Qualifications" desc="Synergy pre-qualifies — but verify everything. Mark each answer as it comes in. A hard DQ triggers the exit protocol automatically." />
      <ScriptBlock label="Transition" labelColor="#5b9cf6" note="Frame this as your process, not a re-screening. They've already been qualified once — this is you being thorough on their behalf.">
        Good — I appreciate that context. Let me just run through a few quick benchmarks on our end to make sure we're set up to get you the best match in the network. Shouldn't take more than a couple minutes.
      </ScriptBlock>
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#5b9cf6" }}>Confirmation Questions</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {LT_QUALS.map(q => (
            <div key={q.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 0", borderBottom:"1px solid #2a2d32", ...qualItemStyle(q.id) }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:accentOrange, minWidth:20, paddingTop:2 }}>{q.num}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, color:"#f0f0ee", lineHeight:1.6 }}><strong>{q.label}</strong> — {q.question}</div>
                <div style={{ fontSize:12, color:"#5a5d5f", marginTop:4, fontFamily:"'DM Mono', monospace" }}>{q.why}</div>
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  <button style={qualBtnStyle(q.id, "pass")} onClick={() => markQual(q.id, "pass")}
                    onMouseEnter={e=>{if(qualState[q.id]!=="pass"){e.currentTarget.style.borderColor="#c8f060";e.currentTarget.style.color="#c8f060"}}}
                    onMouseLeave={e=>{if(qualState[q.id]!=="pass"){e.currentTarget.style.borderColor="#353a40";e.currentTarget.style.color="#5a5d5f"}}}
                  >{q.passLabel}</button>
                  {q.hasWarn ? (
                    <button style={qualBtnStyle(q.id, "warn")} onClick={() => markQual(q.id, "warn")}
                      onMouseEnter={e=>{if(qualState[q.id]!=="warn"){e.currentTarget.style.borderColor="#f5a623";e.currentTarget.style.color="#f5a623"}}}
                      onMouseLeave={e=>{if(qualState[q.id]!=="warn"){e.currentTarget.style.borderColor="#353a40";e.currentTarget.style.color="#5a5d5f"}}}
                    >{q.warnLabel}</button>
                  ) : (
                    <button style={qualBtnStyle(q.id, "fail")} onClick={() => markQual(q.id, "fail")}
                      onMouseEnter={e=>{if(qualState[q.id]!=="fail"){e.currentTarget.style.borderColor="#f06060";e.currentTarget.style.color="#f06060"}}}
                      onMouseLeave={e=>{if(qualState[q.id]!=="fail"){e.currentTarget.style.borderColor="#353a40";e.currentTarget.style.color="#5a5d5f"}}}
                    >{q.failLabel}</button>
                  )}
                </div>
                {!q.hasWarn && qualState[q.id] === "fail" && q.dqReason && (
                  <div style={{ fontSize:12, color:"#f06060", marginTop:6, fontFamily:"'DM Mono', monospace", padding:"6px 10px", background:"rgba(240,96,96,0.07)", borderRadius:5 }}>{q.dqReason}</div>
                )}
                {q.hasWarn && qualState[q.id] === "warn" && q.warnReason && (
                  <div style={{ fontSize:12, color:"#f5a623", marginTop:6, fontFamily:"'DM Mono', monospace", padding:"6px 10px", background:"rgba(245,166,35,0.07)", borderRadius:5 }}>{q.warnReason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {dqId && (
        <div>
          <div style={{ background:"rgba(240,96,96,0.06)", border:"1px solid rgba(240,96,96,0.3)", borderRadius:10, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", background:"rgba(240,96,96,0.1)", borderBottom:"1px solid rgba(240,96,96,0.2)" }}>
              <span style={{ fontSize:16 }}>⚠</span>
              <span style={{ fontSize:12, fontWeight:600, color:"#f06060", letterSpacing:"0.08em", textTransform:"uppercase" }}>Hard Disqualifier — Exit Protocol</span>
            </div>
            <div style={{ padding:16 }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Say to the client:</div>
              <div style={{ fontSize:14, color:"#f0f0ee", lineHeight:1.8, padding:"12px 14px", background:"#1c1f23", borderRadius:8, borderLeft:"3px solid #f06060" }}>
                "Hey <Em>[Name]</Em> — I appreciate your time, I'm just not able to assist you on this channel today. You have a great day!"
              </div>
              <div style={{ fontSize:10, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:16, marginBottom:8 }}>Then immediately — before calling back:</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"12px 14px", background:"#1c1f23", borderRadius:8, borderLeft:"3px solid #f5a623" }}>
                {["Disconnect the call.","Alert management — flag the lead, note the DQ reason, and submit for Synergy credit.","Switch to soft phone — call the client back from your soft phone, not the transfer line.","Work the sale independently — you're now off the Synergy transfer. Call back from your soft phone and present whatever fits."].map((item, i) => (
                  <div key={i} style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.5 }}>{i+1}. <strong style={{ color:"#f5a623" }}>{item.split(" — ")[0].replace(/^\d\. /, "")}</strong>{item.includes(" — ") ? " — " + item.split(" — ")[1] : ""}</div>
                ))}
              </div>
              {DQ_REASONS[dqId] && <div style={{ fontSize:12, color:"#f06060", marginTop:12, fontFamily:"'DM Mono', monospace", padding:"8px 10px", background:"rgba(240,96,96,0.07)", borderRadius:5 }}>{DQ_REASONS[dqId]}</div>}
            </div>
          </div>
          <button onClick={resetQuals} style={{ marginTop:12, padding:"10px 20px", borderRadius:6, fontFamily:"'Syne', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", border:"1px solid #353a40", background:"#1c1f23", color:"#9a9d9e" }}>↺ Reset Qualifications</button>
        </div>
      )}

      {allPass && !dqId && (
        <div style={{ background:"rgba(200,240,96,0.07)", border:"1px solid rgba(200,240,96,0.25)", borderRadius:8, padding:"14px 16px", marginTop:4 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#c8f060", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>All benchmarks confirmed</div>
          <div style={{ fontSize:13, color:"#9a9d9e" }}>File is clean — proceed to the pitch.</div>
        </div>
      )}

      <ObjSection title="Objections" objs={getLTObjsForSection(1)} filterable={true} />
      {!dqId && <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Next: The Pitch →" />}
    </div>,

    // 2: Pitch
    <div>
      <SectionHeader badge="Step 03" title="The Pitch" desc="They've confirmed. Now tie their specific situation to what Swift Path does — and why it's the right move right now." />
      <ScriptBlock label="Pitch Script" labelColor="#40c4a0" note="Fill in the bracketed info from the Synergy sheet + re-confirmation. Personalizing the pitch with their actual numbers is what separates this from a canned speech — they just told you everything, use it.">
        Okay <Em>[Name]</Em> — based on everything you've laid out, here's what I can do for you.<br/><br/>
        Swift Path's model is built around one thing: getting your business profile in front of the right capital sources at the same time, not one at a time. Most funding companies have one or two lenders they work with. We run your file across our entire network of 50-plus institutional and private funders simultaneously — that's what creates competing offers, and competing offers are what give us leverage on your terms.<br/><br/>
        The other thing that separates us: we don't just submit and hand you whatever comes back. Our team works those relationships to get rates pushed down before we ever bring a number to you. So by the time you're looking at an offer, it's already been negotiated — not just quoted.<br/><br/>
        For a business doing <Em>[monthly revenue]</Em> a month with <Em>[time in business]</Em> behind it, looking for <Em>[amount]</Em> for <Em>[use of funds]</Em> — you're in the range where we can get your file working through multiple channels at once. That's where the real value is.<br/><br/>
        Here's how we move from here — and this part is important.
      </ScriptBlock>
      <ObjSection title="Objections" objs={getLTObjsForSection(2)} filterable={true} />
      <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Next: Doc Request →" />
    </div>,

    // 3: Doc Request
    <div>
      <SectionHeader badge="Step 04A" title="The Doc Request" desc="Plant the why before the ask — same logic, different angle without the Director." />
      <ScriptBlock label="Doc Request Script" labelColor="#f5a623" note="You've already built Swift Path's credibility in the pitch — this is the logical next step, not a new ask. Plant it as process.">
        To get your file submitted across the network, our underwriting team needs two things from you — and I want to explain why both matter before I send the links.<br/><br/>
        First is your last 4 months of business bank statements. The statements are what every funder in the network uses to underwrite your actual cash flow — your deposit history, your average daily balance, your consistency. That's not just paperwork, that's the data our team uses to position your file competitively and push for better terms on your behalf. Without it, we're submitting a profile with no backbone.<br/><br/>
        Second is a signed application. That's the legal authorization that allows our underwriting team to formally submit your file and negotiate on your behalf across the network. Without it, funders can't legally issue us an offer or allow us to work the terms for you.<br/><br/>
        Both need to be in the system at least 2 hours before your scheduled review — that's the window our team uses to work the network and have real numbers ready before you hear back.<br/><br/>
        I'm sending both links to your phone right now.
      </ScriptBlock>
      <ObjSection title="Objections" objs={getLTObjsForSection(3)} filterable={true} />
      <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Next: Sending Links →" />
    </div>,

    // 4: Sending Links
    <div>
      <SectionHeader badge="Step 04B" title="Sending the Links & Reading the Room" desc="Confirm receipt, then take the right path." />
      <ScriptBlock label="Send Links Script" labelColor="#f5a623" note="Wait for confirmation. Then read the room.">
        Both links are headed to you right now — you should see them come through in just a second.<br/><br/>
        The first is your application — it'll have your basic info pre-filled so it should be a quick confirm and sign. The second is your secure document upload portal for the bank statements.<br/><br/>
        Let me know when you see them.
      </ScriptBlock>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {[
          { label:"Path A — Ready now", text:"\"Perfect — are you in front of your computer or do you have your bank statements accessible? I can walk you right through both in about 4 minutes and make sure everything hits the system clean.\"", note:"If yes → proceed to Step 04C Live Walkthrough" },
          { label:"Path B — Not ready now", text:"\"No problem — both links will be waiting. Open the application first, confirm your info, sign at the bottom. Then open the upload link and drop in your last 4 months of business bank statements as PDFs.\n\nJust keep in mind I can only hold your review slot until [Time] — our underwriting team needs that 2-hour window to work the network before your review. Text me if you hit anything.\"" }
        ].map((p, i) => (
          <div key={i} style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:accentOrange, marginBottom:8 }}>{p.label}</div>
            <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.7, whiteSpace:"pre-line" }}>{p.text}{p.note && <><br/><br/><span style={{ color:accentOrange, fontSize:12 }}>{p.note}</span></>}</div>
          </div>
        ))}
      </div>
      <ObjSection title="Objections" objs={getLTObjsForSection(4)} filterable={true} />
      <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Next: Live Walkthrough →" />
    </div>,

    // 5: Live Walkthrough
    <div>
      <SectionHeader badge="Step 04C" title="Live Walkthrough" desc="Path A only — stay on the line through both submissions." />
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#a78bfa" }}>Walkthrough Steps</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {[
            { num:"01", title:"Application — confirm pre-filled info", text:"\"Go ahead and open the first link — the application. Everything should be pre-filled from your intake. Take a quick look and confirm your name, business name, and contact info all look correct.\"", wait:"Wait → \"Does everything look right?\"" },
            { num:"02", title:"Signature", text:"\"At the bottom you'll see the signature field. Go ahead and sign — type your name or use the draw option, whatever's easiest. That's your legal authorization for our underwriting team to formally submit and negotiate your file across the network.\"", wait:"Wait for confirmation" },
            { num:"03", title:"Submit the application", text:"\"Perfect — go ahead and hit submit. You should see a confirmation screen. Let me know when you've got it.\"", wait:"Wait → \"Great — application is in. Now let's get the statements up.\"" },
            { num:"04", title:"Bank statement upload", text:"\"Now open the second link — the secure upload portal. I need your last 4 months of business bank statements. Most banks let you download those as PDFs from online banking under 'Statements' or 'Account History.' Once you've got them just drag and drop or hit upload and select the files.\"", wait:"If they need a minute → \"No rush — I'll hold right here.\"" },
            { num:"05", title:"Upload confirmation", text:"\"Once those are in, hit submit. Do you see the confirmation screen?\"", wait:"When confirmed → \"Perfect — your file is in the system. Our underwriting team has it now and I'm flagging it for priority review. You're locked in.\"" },
          ].map(s => (
            <div key={s.num} style={{ display:"flex", gap:14, padding:"14px 0", borderBottom:"1px solid #2a2d32" }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#5a5d5f", minWidth:20, paddingTop:2 }}>{s.num}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:accentOrange, marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6 }}>{s.text}</div>
                <div style={{ fontSize:12, color:"#5a5d5f", fontFamily:"'DM Mono', monospace", marginTop:6 }}>{s.wait}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", fontSize:13, lineHeight:1.7, color:"#9a9d9e", fontStyle:"italic", borderLeft:"2px solid #353a40", margin:"0 16px 16px", borderRadius:"0 4px 4px 0" }}>Stay on the line through both confirmations. Once that second screen hits, there's nothing left to ghost on.</div>
      </div>
      <ObjSection title="Objections" objs={getLTObjsForSection(5)} filterable={true} />
      <NavButtons onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Next: Commitment →" />
    </div>,

    // 6: Commitment
    <div>
      <SectionHeader badge="Step 04D" title="The Commitment" desc="Close the loop. Say this regardless of which path they took." accentColor="#c8f060" />
      <ScriptBlock label="Commitment Script" labelColor="#c8f060" note="Re-anchors the commitment without pressure. Works on both Path A and Path B.">
        Just to confirm — your file is flagged and your review slot is locked. The moment those docs hit the system our underwriting team starts working your profile across the network.<br/><br/>
        Does that sound fair?
      </ScriptBlock>
      <ObjSection title="Objections" objs={getLTObjsForSection(6)} filterable={true} />
      <NavButtons onBack={() => setStep(5)} onNext={() => setStep(7)} nextLabel="Next: Final Hand-off →" />
    </div>,

    // 7: Final Hand-off
    <div>
      <SectionHeader badge="Step 05" title="Final Hand-off & Contact Info" desc="Close clean — confident, not explanatory." accentColor="#c8f060" />
      <ScriptBlock label="Close Script" labelColor="#c8f060">
        From here, three steps:<br/><br/>
        <strong>One:</strong> Check your texts. Open the application link, confirm your info, and sign. Then open the upload link and drop in your last 4 months of business bank statements.<br/><br/>
        <strong>Two:</strong> Our underwriting team gets to work. The moment your file is complete they're submitting your profile across the network and working the terms before your review.<br/><br/>
        <strong>Three:</strong> You'll hear directly from our team with findings and next steps.<br/><br/>
        And <Em>[Name]</Em> — you've got my direct number. Portal issues, upload snags, any questions at all — text or call me directly. I'm your point of contact until this file is through underwriting.
      </ScriptBlock>
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#5a5d5f" }}>Your Info</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {[
            { label:"Name", value: agentInfo.name || "—" },
            { label:"Title", value:"Pre-Underwriting Specialist, Swift Path Capital" },
            { label:"Direct Number", value: agentInfo.number || "—" },
            { label:"Application Link", value: agentInfo.appUrl || "—" },
            { label:"Upload Portal", value: agentInfo.uploadUrl || "—" },
          ].map((r, i) => (
            <div key={i} style={{ display:"flex", gap:14, padding:"10px 0", borderBottom: i < 4 ? "1px solid #2a2d32" : "none" }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:accentOrange, minWidth:20, paddingTop:2 }}>→</div>
              <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6 }}>{r.label}: <span style={{ color:accentOrange }}>{r.value}</span></div>
            </div>
          ))}
        </div>
      </div>
      <ObjSection title="Objections" objs={getLTObjsForSection(7)} filterable={true} />
      <NavButtons onBack={() => setStep(6)} onRestart={() => { setStep(0); window.scrollTo(0,0); }} />
    </div>,
  ];

  return (
    <div style={{ display:"flex", flex:1, minHeight:"100%" }}>
      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:12, padding:28, width:420, maxWidth:"90vw" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0f0ee", marginBottom:20 }}>Agent Info</div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[{label:"Your Name",key:"name",ph:"Your Name"},{label:"Direct Number",key:"number",ph:"Your Number"},{label:"Application URL",key:"appUrl",ph:"Application Link"},{label:"Upload Portal URL",key:"uploadUrl",ph:"Upload Portal Link"}].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:11, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", display:"block", marginBottom:6 }}>{f.label}</label>
                  <input value={settingsDraft[f.key]} onChange={e => setSettingsDraft(d => ({...d, [f.key]:e.target.value}))} placeholder={f.ph} style={{ width:"100%", background:"#1c1f23", border:"1px solid #353a40", borderRadius:6, color:"#f0f0ee", fontFamily:"'DM Mono', monospace", fontSize:13, padding:"9px 12px", outline:"none" }} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24, justifyContent:"flex-end" }}>
              <button onClick={() => setShowSettings(false)} style={{ padding:"9px 18px", borderRadius:6, border:"1px solid #353a40", background:"transparent", color:"#9a9d9e", fontFamily:"'Syne', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => { setAgentInfo(settingsDraft); setShowSettings(false); }} style={{ padding:"9px 18px", borderRadius:6, border:"none", background:accentOrange, color:"#0e0f11", fontFamily:"'Syne', sans-serif", fontSize:13, fontWeight:600, cursor:"pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Inner sidebar for steps */}
      <div style={{ width:200, minWidth:200, background:"#15171a", borderRight:"1px solid #2a2d32", display:"flex", flexDirection:"column", overflowY:"auto" }}>
        <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #2a2d32" }}>
          <div style={{ fontSize:10, fontWeight:600, color:accentOrange, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>Live Transfer</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#9a9d9e" }}>Synergy Direct</div>
        </div>
        <nav style={{ padding:"8px 0", flex:1 }}>
          <div style={{ fontSize:10, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", padding:"6px 16px 4px" }}>Steps</div>
          {LT_SECTIONS.map((s, i) => (
            <div key={i} onClick={() => { setStep(i); window.scrollTo(0,0); }}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", cursor:"pointer", fontSize:12, color: step===i ? accentOrange : "#9a9d9e", borderLeft:`2px solid ${step===i ? accentOrange : "transparent"}`, background: step===i ? "rgba(240,160,96,0.06)" : "transparent", transition:"all 0.15s" }}
              onMouseEnter={e=>{if(step!==i){e.currentTarget.style.color="#f0f0ee";e.currentTarget.style.background="#1c1f23"}}}
              onMouseLeave={e=>{if(step!==i){e.currentTarget.style.color="#9a9d9e";e.currentTarget.style.background="transparent"}}}
            >
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color: step===i ? accentOrange : "#5a5d5f", minWidth:18 }}>{String(i).padStart(2,"0")}</span>
              {s.title}
            </div>
          ))}
        </nav>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #2a2d32" }}>
          <div style={{ fontSize:11, color:"#5a5d5f", lineHeight:1.8, fontFamily:"'DM Mono', monospace" }}>
            Pre-Underwriting<br/>
            <span style={{ color:"#9a9d9e" }}>{agentInfo.name || "—"}</span><br/>
            <span style={{ color:"#9a9d9e" }}>{agentInfo.number || "—"}</span>
          </div>
          <button onClick={() => { setSettingsDraft(agentInfo); setShowSettings(true); }} style={{ marginTop:8, width:"100%", padding:"6px 10px", background:"#1c1f23", border:"1px solid #353a40", borderRadius:6, color:"#9a9d9e", fontFamily:"'Syne', sans-serif", fontSize:11, fontWeight:600, cursor:"pointer", textAlign:"left" }}>⚙ Agent Info</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        {/* Step topbar */}
        <div style={{ background:"#15171a", borderBottom:"1px solid #2a2d32", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:5 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"#f0f0ee" }}>{LT_SECTIONS[step].title}</div>
            <div style={{ fontSize:11, color:"#5a5d5f", fontFamily:"'DM Mono', monospace" }}>{LT_SECTIONS[step].sub}</div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {LT_SECTIONS.map((_, i) => (
              <div key={i} style={{ width:6, height:6, borderRadius:"50%", background: i < step ? accentOrange : i === step ? accentOrange : "#353a40", boxShadow: i === step ? `0 0 6px ${accentOrange}` : "none", transition:"background 0.2s" }} />
            ))}
          </div>
        </div>
        <div style={{ padding:24, maxWidth:820 }}>
          {sections_content[step]}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// WEBFORM SCRIPT
// ─────────────────────────────────────────────
function WebformScript({ agent }) {
  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState(agent?.full_name || "");
  const [agentNumber, setAgentNumber] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");

  const accentGreen = "#c8f060";

  function Em2({ children }) {
    return <span style={{ color:accentGreen, fontStyle:"normal", fontWeight:600 }}>{children}</span>;
  }

  const objSets = [
    WF_OBJECTIONS.opener,
    WF_OBJECTIONS.audit,
    WF_OBJECTIONS.approval,
    WF_OBJECTIONS.links,
    WF_OBJECTIONS.walkthrough,
    [],
    WF_OBJECTIONS.close,
  ];

  const sections_content = [
    // 0: Opener
    <div>
      <SectionHeader badge="Step 01" title="The Opener" desc="They raised their hand first — you're following up on their request." accentColor={accentGreen} />
      <div style={{ background:"#1c1f23", border:"1px solid #2a2d32", borderRadius:10, padding:16, marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[{label:"Agent Name",val:agentName,set:setAgentName,ph:"Your Name"},{label:"Direct Number",val:agentNumber,set:setAgentNumber,ph:"Your Number"},{label:"Application URL",val:appUrl,set:setAppUrl,ph:"Application Link"},{label:"Upload Portal URL",val:uploadUrl,set:setUploadUrl,ph:"Upload Portal Link"}].map(f => (
          <div key={f.label}>
            <label style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#5a5d5f", display:"block", marginBottom:4 }}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={{ background:"#15171a", border:"1px solid #353a40", borderRadius:6, color:"#f0f0ee", fontFamily:"'DM Mono', monospace", fontSize:13, padding:"8px 10px", width:"100%", outline:"none" }} onFocus={e=>e.target.style.borderColor=accentGreen} onBlur={e=>e.target.style.borderColor="#353a40"} />
          </div>
        ))}
      </div>
      <ScriptBlock label="Opening Script" labelColor={accentGreen} note="The funders and lenders network planted here does the heavy lifting for the doc request in Step 3 — by then they already understand exactly why both documents matter.">
        Hey <Em2>[Name]</Em2>, this is <Em2>[Your Name]</Em2> calling from the Pre-Underwriting desk at Swift Path Capital. I'm following up on the request that came through our system for business capital funding.<br/><br/>
        I work directly with our Director of Allocations. He has direct relationships with over 50 institutional and private funders and lenders. What that means for you is that when your file hits his desk, he's not pulling up one option — he's submitting your profile across every funder and lender you qualify for simultaneously, and then he personally negotiates the rates down on your behalf before he ever gets on the phone with you.<br/><br/>
        You're essentially getting a $600 million track record and a network of 50-plus institutional and private funders and lenders working for you before the conversation even starts.<br/><br/>
        My role is to run a quick Verbal Audit to confirm you meet the benchmarks so I can get your file prioritized and in front of him. It takes about 3 minutes. Ready to get started?
      </ScriptBlock>
      <ObjSection title="Opener Objections" objs={WF_OBJECTIONS.opener} />
      <NavButtons onNext={() => setStep(1)} nextLabel="Next: Verbal Audit →" />
    </div>,

    // 1: Verbal Audit
    <div>
      <SectionHeader badge="Step 02" title="The Verbal Audit" desc="Clear these 6 benchmarks before moving to approval. Capture every answer." accentColor={accentGreen} />
      <ScriptBlock label="Transition" labelColor="#5b9cf6">
        Alright, let me pull up your file and clear these benchmarks:
      </ScriptBlock>
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#5b9cf6" }}>Audit Questions</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {WF_AUDIT.map(a => (
            <div key={a.num} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 0", borderBottom:"1px solid #2a2d32" }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:accentGreen, minWidth:20, paddingTop:2 }}>{a.num}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, color:"#f0f0ee", lineHeight:1.6 }}><strong>{a.label}</strong><br/>{a.question}</div>
                {a.note && <div style={{ fontSize:12, color:"#5a5d5f", marginTop:4, fontFamily:"'DM Mono', monospace" }}>{a.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ObjSection title="Audit Objections" objs={WF_OBJECTIONS.audit} />
      <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Next: Approval & Docs →" />
    </div>,

    // 2: Approval & Docs
    <div>
      <SectionHeader badge="Step 03A" title="Approval & Why We Need the Docs" desc="Once they clear the audit benchmarks — plant the why before the ask." accentColor={accentGreen} />
      <ScriptBlock label="Approval Script" labelColor="#40c4a0" note="Plant this as process, not policy. When the why makes sense, the doc request becomes obvious — not an obstacle.">
        Okay <Em2>[Name]</Em2>, based on what you've shared you hit the criteria — I'm approving your file to move to the Director's desk.<br/><br/>
        Here's how the process works, and this part is important.<br/><br/>
        The moment your file is complete, the Director submits your profile out to every institutional and private funder and lender in his network that you qualify for — all at once. Then he uses those direct relationships to negotiate your rates down across the board before he ever picks up the phone with you.<br/><br/>
        The only way he can do that is if he has your bank statements in hand. The statements are what tell each funder and lender your actual cash flow, your deposit history, your average daily balance — that is the leverage he uses to negotiate.<br/><br/>
        And the signed application — that's not just paperwork. That is a signed legal document proving that you are an actual person formally applying for capital. Without it, the funders and lenders cannot legally issue him an offer or allow him to negotiate on your behalf. It gives him the legal standing to go to bat for you across his entire network.<br/><br/>
        That's why Pre-Underwriting requires both documents submitted at least 2 hours before the scheduled appointment — so he has the time to work his funders and lenders and have real numbers ready before you even say hello.
      </ScriptBlock>
      <ObjSection title="Doc Request Objections" objs={WF_OBJECTIONS.approval} />
      <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Next: Sending Links →" />
    </div>,

    // 3: Sending Links
    <div>
      <SectionHeader badge="Step 03B" title="Sending the Links & Reading the Room" desc="Send both links, confirm receipt, then take the right path." accentColor={accentGreen} />
      <ScriptBlock label="Send Links Script" labelColor="#f5a623" note="Wait for them to confirm receipt. Then read the room and take the right path below.">
        I'm sending you two links right now — your text should show both of them in just a second.<br/><br/>
        The first link is your application — everything is pre-filled from the information you provided so it should be a quick confirm and sign. The second link is your secure document upload portal for the bank statements.<br/><br/>
        Let me know when you see them come through.
      </ScriptBlock>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {[
          { label:"Path A — Ready now", text:"\"Perfect — are you in front of your computer right now or do you have your bank statements accessible? I can walk you right through both in about 4 minutes and make sure everything hits the system clean so the Director has exactly what he needs.\"", note:"If yes → proceed to Step 03C Live Walkthrough" },
          { label:"Path B — Not ready now", text:`"No problem — both links will be waiting for you. When you're ready: open the application link first, confirm your info is correct, and sign at the bottom. Then open the upload link and drop in your last 4 months of business bank statements as PDFs. That's it.\n\nJust keep in mind I can only hold your Review-Ready status until [Time]. The Director needs that 2-hour window to work his funders and lenders before the call — so as soon as you're in front of your docs just knock it out. If you hit a snag on anything, text me directly."` }
        ].map((p, i) => (
          <div key={i} style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:accentGreen, marginBottom:8 }}>{p.label}</div>
            <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6, whiteSpace:"pre-line" }}>{p.text}{p.note && <><br/><br/><span style={{ color:accentGreen, fontSize:12 }}>{p.note}</span></>}</div>
          </div>
        ))}
      </div>
      <ObjSection title="Objections at This Stage" objs={WF_OBJECTIONS.links} />
      <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Next: Live Walkthrough →" />
    </div>,

    // 4: Live Walkthrough
    <div>
      <SectionHeader badge="Step 03C" title="Live Walkthrough" desc="Path A only — stay on the line and walk every step." accentColor={accentGreen} />
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#a78bfa" }}>Walkthrough Steps</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {[
            { num:"01", title:"Application — confirm pre-filled info", text:"\"Go ahead and open the first link — the application. Everything should already be filled in from what you provided. Just take a quick look and confirm your name, business name, and contact info all look correct.\"", wait:"Wait → \"Does everything look right?\"" },
            { num:"02", title:"Signature", text:"\"At the bottom you'll see the signature field. Go ahead and sign there — you can type your name or use the draw option, whatever's easiest. That signature is your legal authorization for the Director to represent your file in front of the funders and lenders and negotiate on your behalf.\"", wait:"Wait for confirmation" },
            { num:"03", title:"Submit the application", text:"\"Perfect — go ahead and hit submit on that. You should see a confirmation. Let me know when you've got it.\"", wait:"Wait → \"Great — application is in. Now let's get the statements uploaded.\"" },
            { num:"04", title:"Bank statement upload", text:"\"Now open the second link — that's the secure upload portal for your bank statements. I need your last 4 months of business bank statements. Most banks let you download those as PDFs straight from your online banking under 'Statements' or 'Account History.' Once you've got them pulled up just drag and drop them into the upload area or hit the upload button and select the files.\"", wait:"If they need a minute → \"No rush — I'll hold right here.\"" },
            { num:"05", title:"Upload confirmation", text:"\"Once those are in, hit submit. Do you see the confirmation screen?\"", wait:"When confirmed → \"Perfect — your file just hit the system. I'm walking this into the Director's office right now and flagging it priority. You're locked in.\"" },
          ].map(s => (
            <div key={s.num} style={{ display:"flex", gap:14, padding:"14px 0", borderBottom:"1px solid #2a2d32" }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:"#5a5d5f", minWidth:20, paddingTop:2 }}>{s.num}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:accentGreen, marginBottom:6 }}>{s.title}</div>
                <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6 }}>{s.text}</div>
                <div style={{ fontSize:12, color:"#5a5d5f", fontFamily:"'DM Mono', monospace", marginTop:6 }}>{s.wait}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px", fontSize:13, lineHeight:1.7, color:"#9a9d9e", fontStyle:"italic", borderLeft:"2px solid #353a40", margin:"0 16px 16px", borderRadius:"0 4px 4px 0" }}>Staying on the line through both submissions removes every friction point. Once that second confirmation screen hits, the file is done and there's nothing left to ghost on.</div>
      </div>
      <ObjSection title="Friction Objections" objs={WF_OBJECTIONS.walkthrough} />
      <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Next: Commitment →" />
    </div>,

    // 5: Commitment
    <div>
      <SectionHeader badge="Step 03D" title="The Walk-In Commitment" desc="Say this regardless of which path they took. Closes the loop without pressure." accentColor={accentGreen} />
      <ScriptBlock label="Commitment Script" labelColor={accentGreen} note="Say this regardless of which path they took. It closes the loop and re-anchors the commitment without pressure.">
        Just to confirm — I've got your file flagged and your slot is locked. Once those docs hit the system I'll personally walk them into the Director's office to make sure your file is at the top of his review pile.<br/><br/>
        Does that sound fair?
      </ScriptBlock>
      <NavButtons onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Next: Final Hand-off →" />
    </div>,

    // 6: Final Hand-off
    <div>
      <SectionHeader badge="Step 04" title="Final Hand-off & Contact Info" desc="Close clean — confident, not explanatory." accentColor={accentGreen} />
      <ScriptBlock label="Close Script" labelColor={accentGreen} note={'"You\'ve got my direct number" does more than give them contact info — it positions you as their advocate inside the company, not just another rep who handed them a link.'}>
        From here, three steps:<br/><br/>
        <strong>One:</strong> Check your texts. Open the application link, confirm your info, and sign at the bottom. Then open the upload link and drop in your last 4 months of business bank statements.<br/><br/>
        <strong>Two:</strong> The Director gets to work. The moment your file is complete he starts submitting to his network of institutional and private funders and lenders and negotiating your rates down before the call.<br/><br/>
        <strong>Three:</strong> You'll hear directly from our team with his findings and next steps.<br/><br/>
        And <Em2>[Name]</Em2> — you've got my direct number. If anything comes up with the portal, if you hit a snag on the upload, or if you just have a question, text or call me directly. I'm your point of contact until this file is in front of the Director.
      </ScriptBlock>
      <div style={{ background:"#15171a", border:"1px solid #2a2d32", borderRadius:10, marginBottom:16, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderBottom:"1px solid #2a2d32", background:"#1c1f23" }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"#5a5d5f" }}>Your Info</span>
        </div>
        <div style={{ padding:"8px 16px 16px" }}>
          {[
            { label:"Name", val:agentName || "Your Name" },
            { label:"Title", val:"Pre-Underwriting Specialist, Swift Path Capital" },
            { label:"Direct Number", val:agentNumber || "Your Number" },
            { label:"Application Link", val:appUrl || "—" },
            { label:"Upload Portal", val:uploadUrl || "—" },
          ].map((r, i) => (
            <div key={i} style={{ display:"flex", gap:14, padding:"10px 0", borderBottom: i < 4 ? "1px solid #2a2d32" : "none" }}>
              <div style={{ fontFamily:"'DM Mono', monospace", fontSize:12, color:accentGreen, minWidth:20, paddingTop:2 }}>→</div>
              <div style={{ fontSize:13, color:"#9a9d9e", lineHeight:1.6 }}>{r.label}: <span style={{ color:accentGreen }}>{r.val}</span></div>
            </div>
          ))}
        </div>
      </div>
      <ObjSection title="Late-Stage Objections" objs={WF_OBJECTIONS.close} />
      <NavButtons onBack={() => setStep(5)} onRestart={() => { setStep(0); window.scrollTo(0,0); }} />
    </div>,
  ];

  return (
    <div style={{ display:"flex", flex:1, minHeight:"100%" }}>
      {/* Inner sidebar */}
      <div style={{ width:200, minWidth:200, background:"#15171a", borderRight:"1px solid #2a2d32", display:"flex", flexDirection:"column", overflowY:"auto" }}>
        <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #2a2d32" }}>
          <div style={{ fontSize:10, fontWeight:600, color:accentGreen, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>Webform</div>
          <div style={{ fontSize:11, fontWeight:600, color:"#9a9d9e" }}>Opener Script</div>
        </div>
        <nav style={{ padding:"8px 0", flex:1 }}>
          <div style={{ fontSize:10, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.1em", textTransform:"uppercase", padding:"6px 16px 4px" }}>Steps</div>
          {WF_SECTIONS.map((s, i) => (
            <div key={i} onClick={() => { setStep(i); window.scrollTo(0,0); }}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", cursor:"pointer", fontSize:12, color: step===i ? accentGreen : "#9a9d9e", borderLeft:`2px solid ${step===i ? accentGreen : "transparent"}`, background: step===i ? "rgba(200,240,96,0.06)" : "transparent", transition:"all 0.15s" }}
              onMouseEnter={e=>{if(step!==i){e.currentTarget.style.color="#f0f0ee";e.currentTarget.style.background="#1c1f23"}}}
              onMouseLeave={e=>{if(step!==i){e.currentTarget.style.color="#9a9d9e";e.currentTarget.style.background="transparent"}}}
            >
              <span style={{ fontFamily:"'DM Mono', monospace", fontSize:10, color: step===i ? accentGreen : "#5a5d5f", minWidth:18 }}>{String(i).padStart(2,"0")}</span>
              {s.title}
            </div>
          ))}
        </nav>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #2a2d32" }}>
          <div style={{ fontSize:11, color:"#5a5d5f", lineHeight:1.8, fontFamily:"'DM Mono', monospace" }}>
            Pre-Underwriting<br/>
            <span style={{ color:"#9a9d9e" }}>{agentName || "Your Name"}</span><br/>
            <span style={{ color:"#9a9d9e" }}>{agentNumber || "Your Number"}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ background:"#15171a", borderBottom:"1px solid #2a2d32", padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:5 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"#f0f0ee" }}>{WF_SECTIONS[step].title}</div>
            <div style={{ fontSize:11, color:"#5a5d5f", fontFamily:"'DM Mono', monospace" }}>{WF_SECTIONS[step].sub}</div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {WF_SECTIONS.map((_, i) => (
              <div key={i} style={{ width:6, height:6, borderRadius:"50%", background: i < step ? accentGreen : i === step ? accentGreen : "#353a40", boxShadow: i === step ? `0 0 6px ${accentGreen}` : "none", transition:"background 0.2s" }} />
            ))}
          </div>
        </div>
        <div style={{ padding:24, maxWidth:820 }}>
          {sections_content[step]}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN SCRIPTS PAGE
// ─────────────────────────────────────────────
export default function ScriptsPage({ agent }) {
  const [activeTab, setActiveTab] = useState("live");

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #353a40; border-radius: 3px; }
        body { font-family: 'Syne', sans-serif; }
        strong { font-weight: 600; }
      `}</style>
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0e0f11", color:"#f0f0ee", fontFamily:"'Syne', sans-serif", overflow:"hidden" }}>
        {/* Top tab bar */}
        <div style={{ background:"#15171a", borderBottom:"1px solid #2a2d32", padding:"0 24px", display:"flex", alignItems:"center", gap:0, flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#5a5d5f", letterSpacing:"0.12em", textTransform:"uppercase", marginRight:24, padding:"14px 0" }}>Scripts</div>
          {[
            { id:"live", label:"Live Transfer", accent:"#f0a060", subLabel:"Synergy Direct" },
            { id:"webform", label:"Webform Opener", accent:"#c8f060", subLabel:"Inbound Fill" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display:"flex", flexDirection:"column", padding:"14px 20px", border:"none", borderBottom:`2px solid ${activeTab===tab.id ? tab.accent : "transparent"}`, background:"transparent", cursor:"pointer", transition:"all 0.15s", marginBottom:-1 }}
            >
              <span style={{ fontSize:13, fontWeight:600, color: activeTab===tab.id ? tab.accent : "#9a9d9e", transition:"color 0.15s" }}>{tab.label}</span>
              <span style={{ fontSize:10, color: activeTab===tab.id ? tab.accent+"99" : "#5a5d5f", fontFamily:"'DM Mono', monospace", letterSpacing:"0.06em", marginTop:2 }}>{tab.subLabel}</span>
            </button>
          ))}
        </div>

        {/* Script content */}
        <div style={{ flex:1, overflow:"auto", display:"flex" }}>
          {activeTab === "live" ? <LiveTransferScript agent={agent} /> : <WebformScript agent={agent} />}
        </div>
      </div>
    </>
  );
}
