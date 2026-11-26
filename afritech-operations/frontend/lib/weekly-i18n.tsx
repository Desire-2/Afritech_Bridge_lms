'use client';



/**

 * Bilingual labels for the weekly financial report UI.

 *

 * Keep the English and Kinyarwanda dictionaries aligned key-for-key and

 * wording-for-wording with backend/app/services/weekly_i18n.py. This keeps

 * screen labels, notifications and ?lang=rw exports consistent.

 *

 * Only system labels, statuses, validation messages and notification templates

 * live here. User-entered text is always displayed exactly as supplied.

 * Keys prefixed with "ui." are screen-only labels that the backend does not render.

 */



import { useCallback, useEffect, useSyncExternalStore } from 'react';



export type WeeklyLang = 'en' | 'rw';



export const WEEKLY_LANG_STORAGE_KEY = 'abops_weekly_lang';



const LABELS: Record<WeeklyLang, Record<string, string>> = {

  en: {

    "nav.weeklyReports": "Weekly Financial Report",

    "nav.weeklyReview": "Weekly Report Review",

    "page.title": "Weekly Service Agent Financial Report",

    "page.subtitle": "Reconciliation, money submission and financial review",

    "switcher.label": "Language",

    "period.current": "Current week",

    "period.previous": "Previous week",

    "period.select": "Select week",

    "section.overview": "Financial overview",

    "section.transactions": "Weekly transactions",

    "section.closings": "Daily closings",

    "section.expenses": "Approved expenses",

    "section.officialCosts": "Official service cost payments",

    "section.momo": "Money submissions",

    "section.shortage": "Shortage / surplus",

    "section.review": "Financial review",

    "section.audit": "Audit history",

    "field.agent": "Service Agent",

    "field.week": "Week",

    "field.due": "Submission deadline",

    "field.status": "Status",

    "field.transactionCount": "Transaction count",

    "field.collections": "Customer collections",

    "field.serviceCosts": "Service costs",

    "field.costPaymentStatus": "Customer payment status",

    "field.officialCostPaymentStatus": "Official cost verification",

    "field.personalPayment": "Paid from own funds?",

    "field.personalPaidAmount": "Amount paid personally",

    "field.paymentProvider": "Payment provider",

    "field.paidAt": "Payment date & time",

    "field.reviewerDecision": "Reviewer decision",

    "field.authorizedReceipts": "Authorized receipts",

    "field.providerPayments": "Verified provider payments",

    "field.approvedExpenses": "Approved collection-funded expenses",

    "field.refunds": "Authorized refunds",

    "field.otherOutflows": "Other approved cash outflows",

    "field.commissionRetained": "Commission retained",

    "field.expectedRemittance": "Expected remittance",

    "field.agentReported": "Agent-reported submissions",

    "field.verifiedSubmitted": "Verified money submissions",

    "field.shortage": "Shortage",

    "field.surplus": "Surplus",

    "field.commissionEarned": "Commission earned",

    "field.openingOutstanding": "Opening outstanding balance",

    "field.closingOutstanding": "Closing outstanding balance",

    "field.reasonCategory": "Shortage reason category",

    "field.explanation": "Detailed explanation",

    "field.evidence": "Evidence",

    "field.resolutionDate": "Expected resolution date",

    "field.overrideReason": "Authorized override reason",

    "field.provider": "Provider",

    "field.reference": "Reference",

    "field.amount": "Amount",

    "field.declaredSubmitted": "Amount submitted this week",

    "field.submissionFundingSource": "Who funded the service amount?",

    "field.datetime": "Date & time",

    "field.senderPhone": "Sender phone",

    "field.recipientPhone": "Recipient phone",

    "field.confirmation": "Confirmation code",

    "field.notes": "Notes",

    "field.verification": "Verification",

    "field.comments": "Comments",

    "field.original": "Original",

    "field.adjusted": "Adjusted",

    "action.generate": "Generate report",

    "action.generateMine": "Generate my weekly report",

    "action.submit": "Submit report",

    "action.resubmit": "Resubmit",

    "action.addMomo": "Add submission",

    "action.addCostPayment": "Record personal payment",

    "action.verifyCost": "Verify cost payment",

    "action.rejectCost": "Reject cost payment",

    "action.verify": "Verify",

    "action.rejectTransfer": "Reject transfer",

    "action.requestCorrection": "Request correction",

    "action.approve": "Approve",

    "action.reject": "Reject",

    "action.adjust": "Record adjustment",

    "action.downloadPdf": "Download PDF",

    "action.downloadExcel": "Download Excel",

    "action.retry": "Retry",

    "status.draft": "Draft",

    "status.ready_for_submission": "Ready for Submission",

    "status.submitted": "Submitted",

    "status.under_financial_review": "Under Financial Review",

    "status.returned_for_correction": "Returned for Correction",

    "status.approved": "Approved",

    "status.rejected": "Rejected",

    "status.late": "Late",

    "status.pending": "Pending",

    "status.auto_applied": "Applied — confirmed at approval",

    "status.verified": "Verified",

    "status.not_claimed": "Not claimed",

    "status.not_applicable": "Not applicable",

    "status.missing": "Missing",

    "status.paid": "Paid",

    "status.partially_paid": "Partially Paid",

    "status.unpaid": "Unpaid",

    "status.cancelled": "Cancelled",

    "status.refunded": "Refunded",

    "status.reversed": "Reversed",

    "status.yes": "Yes",

    "status.no": "No",

    "status.partial": "Partial",

    "reason.customer_not_paid": "Customer has not paid fully",

    "reason.service_issue": "Unexpected service-related issue",

    "reason.payment_problem": "Payment problem",

    "reason.money_unavailable": "Money temporarily unavailable",

    "reason.incorrect_record": "Incorrect transaction record",

    "reason.other": "Other",

    "error.shortage_explanation": "A valid reason and brief explanation are required.",

    "error.surplus_explanation": "Please confirm or explain the extra amount.",

    "error.shortage_evidence": "Evidence is required when a shortage is reported.",

    "error.unexplained_shortage": "A shortage cannot be submitted without an authorized override reason.",

    "error.duplicate_reference": "That money submission reference already exists.",

    "error.invalid_transition": "This workflow transition is not allowed.",

    "error.locked": "A submitted report is locked; request a correction instead.",

    "error.shortage_resolution": "An expected resolution date is required for a shortage.",

    "error.late_blocked": "Late submissions are blocked by the current reporting policy.",

    "error.claim_duplicate": "This official cost already has a payment claim.",

    "error.claim_invalid_amount": "The personally paid amount must be positive and not exceed the official cost.",

    "error.claim_reference_required": "A payment reference is required.",

    "error.claim_sender_required": "The phone used to pay the cost is required.",

    "error.claim_evidence_required": "Evidence is required for a personal cost payment.",

    "error.claim_invalid_date": "The payment date must fall within the reporting week.",

    "error.claim_not_personal": "A cost not paid from the agent’s own funds cannot be deducted.",

    "error.invalid_week": "A reporting week must start on Sunday in Africa/Kigali.",

    "notification.generated": "Weekly financial report {period} has been generated.",

    "notification.due": "Weekly financial report {period} is due today at {time}.",

    "notification.submitted": "Weekly financial report {period} was submitted by {agent}.",

    "notification.returned": "Weekly financial report {period} was returned for correction.",

    "notification.approved": "Weekly financial report {period} was approved.",

    "notification.rejected": "Weekly financial report {period} was rejected.",

    "notification.shortage": "Weekly report {period} has a shortage of {amount}.",

    "notification.submitted_ack": "Your weekly financial report {period} was submitted.",

    "notification.momo_verified": "Money submission {reference} was {status}.",

    "notification.cost_payment_submitted": "Personal payment {reference} for an official cost in {period} awaits verification.",

    "notification.cost_payment_verified": "Official cost payment {reference} was {status}.",

    "notification.override_requested": "An override was authorised for weekly report {period}.",

    "notification.late": "Weekly financial report {period} is now late.",

    "export.title": "Weekly Service Agent Financial Report",

    "export.period": "Reporting period",

    "export.generatedAt": "Generated at",

    "export.statementItem": "Statement item",

    "export.value": "Value",

    "export.verifiedCalculation": "Verified Calculation",

    "export.component": "Component",

    "export.transaction": "Transaction",

    "export.customerPayment": "Customer payment",

    "export.officialCosts": "Official service costs",

    "export.personalPayment": "Personal payment",

    "export.deductibleAmount": "Verified deductible amount",

    "statement.1": "Reporting period and agent identity",

    "statement.2": "Opening outstanding balance brought forward",

    "statement.3": "Eligible transaction count",

    "statement.4": "Customer collections from eligible transactions",

    "statement.5": "Official service costs and verified personal payments",

    "statement.6": "Authorized receipts during the week",

    "statement.7": "Verified provider payments (agent-funded costs + adjustments)",

    "statement.8": "Approved collection-funded expenses",

    "statement.9": "Authorized refunds",

    "statement.10": "Other approved cash outflows",

    "statement.11": "Commission retained (only if configured)",

    "statement.12": "Expected remittance / expected submission",

    "statement.13": "Agent-reported MoMo/bank submissions",

    "statement.14": "Reviewer-verified money submissions",

    "statement.15": "Shortage amount",

    "statement.16": "Surplus amount",

    "statement.17": "Shortage reason, evidence and resolution date",

    "statement.18": "Commission earned (20% of gross profit, shown separately)",

    "statement.19": "Daily closing coverage and missing-closing overrides",

    "statement.20": "Outstanding balance carried forward with allocation history",

    "statement.21": "Workflow state, approvals, adjustments and audit trail",

    "ui.status.pending_payment": "Pending Payment",

    "ui.status.completed": "Completed",

    "ui.status.failed": "Failed",

    "ui.status.unverified": "Unverified",

    "ui.status.rejected_transfer": "Rejected transfer",

    "ui.reason.customer_not_paid": "Customer has not paid fully",

    "ui.reason.service_issue": "Unexpected service-related issue",

    "ui.reason.payment_problem": "Payment problem",

    "ui.reason.money_unavailable": "Money temporarily unavailable",

    "ui.reason.incorrect_record": "Incorrect transaction record",

    "ui.reason.cash_count_error": "Cash count error",

    "ui.reason.unrecorded_collection": "Unrecorded collection",

    "ui.reason.unapproved_expense": "Unapproved expense",

    "ui.reason.provider_payment_timing": "Provider payment timing",

    "ui.reason.bank_delay": "Bank delay",

    "ui.reason.documentation_error": "Documentation error",

    "ui.reason.other": "Other",

    "ui.adjustment.authorized_receipt": "Authorized receipt",

    "ui.adjustment.provider_payment": "Provider payment",

    "ui.adjustment.collection_expense": "Collection expense",

    "ui.adjustment.authorized_refund": "Authorized refund",

    "ui.adjustment.other_outflow": "Other outflow",

    "ui.adjustment.commission_retained": "Commission retained",

    "ui.adjustment.outstanding_correction": "Outstanding correction",

    "ui.adjustment.outstanding_waiver": "Outstanding waiver",

    "ui.provider.momo": "MoMo",

    "ui.provider.bank_transfer": "Bank transfer",

    "ui.provider.cash_deposit": "Cash deposit",

    "ui.tab.overview": "Overview",

    "ui.tab.transactions": "Transactions",

    "ui.tab.closings": "Daily closings",

    "ui.tab.expenses": "Expenses",

    "ui.tab.officialCosts": "Official costs",

    "ui.tab.momo": "MoMo",

    "ui.tab.shortage": "Shortage / Surplus",

    "ui.tab.review": "Review",

    "ui.tab.audit": "Audit",

    "ui.list.title": "Weekly reports",

    "ui.list.empty": "No weekly reports for this week",

    "ui.list.hint": "Select a week, then choose a report below to inspect its reconciliation.",

    "ui.queue.title": "Reports awaiting review",

    "ui.queue.empty": "No reports are awaiting review",

    "ui.queue.hint": "Submitted, under-review and returned reports appear here.",

    "ui.filter.status": "All statuses",

    "ui.filter.employee": "All agents",

    "ui.filter.search": "Search reference, service or client",

    "ui.filter.service": "All services",

    "ui.filter.paymentStatus": "All payment statuses",

    "ui.filter.start": "From",

    "ui.filter.end": "To",

    "ui.filter.reset": "Clear filters",

    "ui.label.reportNumber": "Report number",

    "ui.label.period": "Period",

    "ui.label.submittedAt": "Submitted at",

    "ui.label.weekStart": "Week starting",

    "ui.label.weekEnd": "Week ending",

    "ui.label.reports": "reports",

    "ui.label.details": "Details",

    "ui.label.view": "View",

    "ui.label.close": "Close",

    "ui.label.save": "Save draft",

    "ui.label.saving": "Saving…",

    "ui.label.cancel": "Cancel",

    "ui.label.remove": "Remove",

    "ui.label.download": "Download evidence",

    "ui.label.noEvidence": "No evidence uploaded",

    "ui.label.none": "—",

    "ui.label.eligible": "Eligible",

    "ui.label.notEligible": "Not eligible",

    "ui.label.date": "Date",

    "ui.label.transaction": "Transaction",

    "ui.label.service": "Service",

    "ui.label.client": "Client",

    "ui.label.price": "Customer price",

    "ui.label.cost": "Official cost",

    "ui.label.paid": "Payment amount",

    "ui.label.grossProfit": "Gross profit",

    "ui.label.commission": "Commission",

    "ui.label.method": "Payment method",

    "ui.label.export": "Export",

    "ui.label.actions": "Actions",

    "ui.label.collections": "Collections",

    "ui.label.costs": "Costs",

    "ui.label.expected": "Expected",

    "ui.label.actual": "Actual",

    "ui.label.difference": "Difference",

    "ui.label.category": "Category",

    "ui.label.description": "Description",

    "ui.label.paymentSource": "Payment source",

    "ui.label.receipt": "Receipt",

    "ui.label.approver": "Approver",

    "ui.label.expectedCash": "Expected cash",

    "ui.label.missingNotice": "A missing closing is not zero: no daily closing was recorded for this day.",

    "ui.label.overrideAuthorized": "Authorized override",

    "ui.label.overrideBy": "Authorized by",

    "ui.label.overrideAt": "Authorized at",

    "ui.label.missingOverride": "Missing-closing acknowledgement",

    "ui.label.statement": "Statement of account",

    "ui.label.item": "No.",

    "ui.label.value": "Value",

    "ui.label.allocations": "Outstanding allocation history",

    "ui.label.adjustments": "Recorded adjustments",

    "ui.label.auditAction": "Action",

    "ui.label.auditActor": "Actor",

    "ui.label.auditWhen": "When",

    "ui.label.auditDetails": "Details",

    "ui.label.reviewNote": "Review note",

    "ui.label.correctionReason": "Correction reason",

    "ui.label.rejectionReason": "Rejection reason",

    "ui.label.kind": "Kind",

    "ui.label.label": "Label",

    "ui.label.reason": "Reason",

    "ui.label.submissionNote": "Submission note",

    "ui.label.weeklySubmission": "Weekly money submission",

    "ui.label.fundingSourceHelp": "Choose who funded the amount. Only reviewer-verified transfers from the agent reduce the shortage — selecting “my phone” alone is not evidence.",

    "ui.source.agent_phone": "My phone",

    "ui.source.company": "Company",

    "ui.source.someone_else": "Someone else",

    "ui.label.evidenceHelp": "PDF, PNG, JPG or WEBP, up to 10 MB.",

    "ui.label.expenseNote": "Only approved collection-funded expenses in the calculation reduce expected remittance.",

    "ui.label.costPaymentNote": "Customer payment status never proves who funded an official cost. A guided own-funds answer reduces expected remittance immediately and is confirmed when the report is approved; manual claims need reviewer verification.",

    "ui.label.costPaymentSummary": "Personal cost claims",

    "ui.label.costPaymentRecorded": "Official cost payment claim recorded.",

    "ui.label.costPaymentRemoved": "Official cost payment claim removed.",

    "ui.label.selectCostTransaction": "Select a transaction to declare how its official cost was paid",

    "ui.label.personalPaymentNo": "No — paid by the company or another source",

    "ui.label.personalPaymentYes": "Yes — paid from my own funds",

    "ui.label.costVerificationNote": "Reviewer note",

    "ui.label.partialPayment": "Partial payment",

    "ui.label.deductibleAmount": "Deductible amount",

    "ui.label.shortageNote": "Amounts below come from the backend calculation and are never recalculated here.",

    "ui.label.verifiedTotal": "Verified submissions drive shortage and surplus.",

    "ui.label.generating": "Generating…",

    "ui.label.loading": "Loading…",

    "ui.label.loadingWeeks": "Loading weeks…",

    "ui.label.records": "records",

    "ui.label.pageOf": "Page {page} of {pages}",

    "ui.label.backToQueue": "Back to queue",

    "ui.label.openWorkspace": "Open workspace",

    "ui.label.submitWeekly": "Submit weekly report",

    "ui.label.reviewWorkspace": "Review workspace",

    "ui.label.allWeeks": "All weeks",

    "ui.label.allBranches": "All branches",

    "ui.label.report": "Report",

    "ui.label.saved": "Draft saved.",

    "ui.label.submitted": "Report submitted.",

    "ui.label.momoAdded": "Money submission added.",

    "ui.label.momoRemoved": "Money submission removed.",

    "ui.label.reviewRecorded": "Review action recorded.",

    "ui.label.adjustmentRecorded": "Adjustment recorded.",

    "ui.label.overrideRecorded": "Override authorized.",

    "ui.label.generated": "Weekly generation complete.",

    "nav.weeklyWorkspace": "Weekly reports",

    "page.workspace.title": "Weekly financial reports",

    "page.workspace.subtitle": "Verify money, resolve exceptions, and record decisions in one workspace.",

    "ui.mode.review": "Needs review",

    "ui.mode.all": "All reports",

    "ui.filter.branch": "Branch",

    "ui.filter.searchReports": "Search reports",

    "ui.filter.shortageOnly": "Shortages",

    "ui.filter.pendingOnly": "Pending checks",

    "ui.filter.unverifiedOnly": "Unverified money",

    "ui.filter.missingClosings": "Missing closings",

    "ui.metric.reviewQueue": "Awaiting decision",

    "ui.metric.shortage": "Shortages",

    "ui.metric.pending": "Pending checks",

    "ui.metric.unverified": "Unverified money",

    "ui.metric.missing": "Missing closings",

    "ui.metric.total": "Reports in scope",

    "ui.list.report": "Report",

    "ui.list.agent": "Agent / branch",

    "ui.list.signals": "Review signals",

    "ui.label.reviewReport": "Review report",

    "ui.label.openReport": "Open report",

    "ui.label.clearAll": "Clear all",

    "ui.label.selectedFilters": "filters active",

    "review.title": "Report review",

    "review.subtitle": "Backend-verified figures only. Verified transfers are the only submissions that clear a shortage.",

    "review.section.financial": "Financial position",

    "review.section.reconciliation": "Reconciliation",

    "review.section.officialCosts": "Official service costs",

    "review.section.momo": "Money submissions",

    "review.section.shortage": "Shortage / surplus investigation",

    "review.section.closings": "Daily breakdown",

    "review.section.decision": "Review decision",

    "review.section.audit": "Decision history",

    "review.expected": "Expected remittance",

    "review.verified": "Verified submissions",

    "review.declared": "Agent-declared",

    "review.verifiedGap": "Verified gap",

    "review.declaredGap": "Declared gap",

    "review.verificationHelp": "Only verified transfers and verified or guided personal cost credits reduce the expected amount.",

    "review.pendingBadge": "Pending verification",

    "review.noClaims": "No personal cost claims to verify.",

    "review.noTransfers": "No money submissions recorded.",

    "review.evidence": "Evidence",

    "review.decisionReason": "Reason or review note",

    "review.approveHelp": "Approval locks the report and carries forward any outstanding balance.",

    "review.returnHelp": "A reason is required before the agent can correct and resubmit.",

    "review.rejectHelp": "A reason is required to reject this report.",

    "review.notDecisionStatus": "This report is locked; no further decision is available.",

    "review.dailyMissing": "No daily closing recorded",

    "review.branchScope": "Manager access is limited to your branch.",

    "review.overviewTab": "Summary",

    "review.officialTab": "Official costs",

    "review.momoTab": "Transfers",

    "review.closingsTab": "Daily",

    "review.auditTab": "Audit",

    "review.recommendation": "Verification status",

    "review.openEvidence": "Open evidence",

    "review.agentAnswer": "Agent's explanation",

    "review.authorizedOverride": "Authorized override",

    "review.completed": "Decision recorded.",

    "review.actionFailed": "The action could not be completed.",

    "review.transferVerified": "Transfer verified.",

    "review.costVerified": "Personal cost verified.",

    "review.returned": "Report returned for correction.",

    "review.approved": "Report approved.",

    "review.rejected": "Report rejected.",

    "notification.openReport": "Open weekly report",

    "ui.error.required": "This field is required.",

    "ui.error.referenceRequired": "A money submission reference is required.",

    "ui.error.referenceShort": "The reference must be at least 4 characters.",

    "ui.error.amountRequired": "A positive amount is required.",

    "ui.error.evidenceType": "Evidence must be a PDF, PNG, JPG or WEBP file.",

    "ui.error.evidenceSize": "Evidence must be 10 MB or smaller.",

    "ui.error.overrideDisabled": "Overrides are disabled by policy.",

    "ui.error.exportFailed": "The export could not be downloaded.",

    "ui.error.loadFailed": "The report could not be loaded.",

    "ui.error.accessDenied": "You do not have access to this weekly report.",

    "ui.agent.title": "My weekly report",

    "ui.agent.subtitle": "Confirm costs, declare what you submitted, then send the report.",

    "ui.agent.step.summary": "1. Your week at a glance",

    "ui.agent.step.costs": "2. Confirm official cost payers",

    "ui.agent.step.submit": "3. Declare and submit",

    "ui.agent.expected": "Expected from you",

    "ui.agent.loadingWeek": "Loading figures for this week…",

    "ui.agent.declared": "Declared by you",

    "ui.agent.evidenceBacked": "Backed by evidence",

    "ui.agent.verifiedReceived": "Verified as received",

    "ui.agent.viewDetails": "View details",

    "ui.agent.detailsTitle": "Where the expected amount comes from",

    "ui.agent.collections": "Customer collections",

    "ui.agent.previousOutstanding": "Previous outstanding balance",

    "ui.agent.officialCosts": "Official service costs",

    "ui.agent.verifiedCredits": "Your verified cost payments",

    "ui.agent.appliedCredits": "Your own-funds costs deducted now",

    "ui.agent.pendingCredits": "Your manual claims awaiting review",

    "ui.agent.companyPaid": "Paid by AfriTech Bridge",

    "ui.agent.someoneElsePaid": "Paid by someone else",

    "ui.agent.notPaid": "Not paid yet",

    "ui.agent.transactions": "Eligible transactions",

    "ui.agent.costIntro": "Choose who paid each official cost you still need to answer. Choosing your own funds deducts the full cost from the amount expected from you now; it is confirmed when the weekly report is approved.",

    "ui.agent.costPersonalAuto": "No extra details needed — we use your profile and this transaction, and record the full official cost. It reduces your expected amount now and is confirmed when the report is approved.",

    "ui.agent.costErrorTitle": "Answer not saved",

    "ui.agent.costErrorRetry": "Try again",

    "ui.agent.errorSummaryTitle": "Please correct the following:",

    "ui.agent.costAutoCompany": "Confirmed automatically — AfriTech Bridge paid",

    "ui.agent.costAutoCompanyNote": "Land Document costs paid by AfriTech Bridge are already confirmed and are not listed here. They never reduce your expected amount.",

    "ui.agent.costAutoAppliedNote": "Deducted from your expected amount. Final confirmation happens when the weekly report is approved.",

    "ui.agent.costSource.personal": "I paid using my own money",

    "ui.agent.costSource.company": "AfriTech Bridge paid",

    "ui.agent.costSource.someone_else": "Someone else paid",

    "ui.agent.costSource.not_paid": "Not paid yet",

    "ui.agent.saveAnswer": "Save answer",

    "ui.agent.changeAnswer": "Change answer",

    "ui.agent.costSaving": "Saving this answer…",

    "ui.agent.costPersonalDetails": "Details of your payment",

    "ui.agent.costPending": "Manual claim awaiting review — no deduction yet",

    "ui.agent.costApplied": "Deducted now: {amount} RWF — confirmed when the report is approved",

    "ui.agent.costVerified": "Verified deduction: {amount} RWF",

    "ui.agent.costNoDeduction": "No deduction from your expected amount",

    "ui.agent.amountPrompt": "How much did you submit for this week?",

    "ui.agent.amountInRwf": "Amount in RWF",

    "ui.agent.compare.equal": "This matches the expected amount. No explanation is needed.",

    "ui.agent.compare.less": "You are short by {amount} RWF. Please tell us why.",

    "ui.agent.compare.zero": "You declared zero. Please tell us why.",

    "ui.agent.compare.more": "You sent {amount} RWF more than expected. Please tell us why.",

    "ui.agent.reason": "Reason",

    "ui.agent.explanation": "Brief explanation",

    "ui.agent.addTransfer": "Add a money transfer",

    "ui.agent.addAnother": "Add another transfer",

    "ui.agent.transferDetails": "Transfer details (optional but helpful)",

    "ui.agent.removeTransfer": "Remove transfer",

    "ui.agent.quickReview": "Quick review",

    "ui.agent.reviewCosts": "Official costs confirmed",

    "ui.agent.reviewTransfers": "Transfers added",

    "ui.agent.submit": "Submit Weekly Report",

    "ui.agent.success": "Report submitted",

    "ui.agent.successDetail": "Your weekly report was sent to the finance reviewer.",

    "ui.agent.error.money": "Enter an amount in RWF using numbers only.",

    "ui.agent.error.reason": "Choose a reason and add a brief explanation.",

    "ui.agent.error.surplus": "Add a brief explanation for the extra amount.",

    "ui.agent.error.costAmount": "Enter an amount greater than zero and not more than the official cost.",

    "ui.agent.error.reference": "The reference must be at least 4 characters.",

    "ui.agent.error.transferAmount": "Enter a transfer amount greater than zero.",

    "ui.agent.error.transferDate": "Use a date within this reporting week (or before the deadline).",

  },

  rw: {

    "nav.weeklyReports": "Raporo y’imari y’icyumweru",

    "nav.weeklyReview": "Isuzuma rya raporo z’icyumweru",

    "page.title": "Raporo y’imari y’umukozi utanga serivisi",

    "page.subtitle": "Guhuza imibare y’amafaranga, kwerekana ayoherejwe no gusuzuma imari",

    "switcher.label": "Ururimi",

    "period.current": "Iki cyumweru",

    "period.previous": "Icyumweru gishize",

    "period.select": "Hitamo icyumweru",

    "section.overview": "Incamake y’imari",

    "section.transactions": "Ibikorwa byakozwe muri iki cyumweru",

    "section.closings": "Raporo zo gusoza buri munsi",

    "section.expenses": "Amafaranga yakoreshejwe yemejwe",

    "section.officialCosts": "Ubwishyu bw’ibiciro byemewe bya serivisi",

    "section.momo": "Amafaranga yoherejwe",

    "section.shortage": "Ibura / Isaguka ry’amafaranga",

    "section.review": "Isuzuma ry’imari",

    "section.audit": "Amateka y’igenzura",

    "field.agent": "Umukozi utanga serivisi",

    "field.week": "Icyumweru",

    "field.due": "Igihe ntarengwa cyo kohereza raporo",

    "field.status": "Imiterere ya raporo",

    "field.transactionCount": "Umubare w’ibikorwa",

    "field.collections": "Amafaranga yakiriwe ku bakiriya",

    "field.serviceCosts": "Ibiciro bya serivisi",

    "field.costPaymentStatus": "Uko umukiriya yishyuye",

    "field.officialCostPaymentStatus": "Igenzura ry’ubwishyu bw’ikiguzi cya serivisi",

    "field.personalPayment": "Ikiguzi cyishyuwe n’umukozi akoresheje amafaranga ye bwite?",

    "field.personalPaidAmount": "Amafaranga umukozi yishyuriye ku giti cye",

    "field.paymentProvider": "Utanga serivisi y’ubwishyu",

    "field.paidAt": "Itariki n’igihe ubwishyu bwakorewe",

    "field.reviewerDecision": "Icyemezo cy’uwasuzumye raporo",

    "field.authorizedReceipts": "Amafaranga yakiriwe yemewe",

    "field.providerPayments": "Amafaranga yishyuwe abatanga serivisi kandi akagenzurwa",

    "field.approvedExpenses": "Amafaranga yemejwe yakoreshejwe mu mafaranga umukozi yakiriye ku bakiriya",

    "field.refunds": "Amafaranga yasubijwe abakiriya mu buryo bwemewe",

    "field.otherOutflows": "Andi mafaranga yasohotse kandi yemejwe",

    "field.commissionRetained": "Komisiyo umukozi yagumanye",

    "field.expectedRemittance": "Amafaranga umukozi agomba kohereza",

    "field.agentReported": "Amafaranga umukozi yatangaje ko yohereje",

    "field.verifiedSubmitted": "Amafaranga yoherejwe yagenzuwe kandi yemejwe",

    "field.shortage": "Amafaranga abura",

    "field.surplus": "Amafaranga asagutse",

    "field.commissionEarned": "Komisiyo umukozi yabonye",

    "field.openingOutstanding": "Amafaranga yari asigaye ataratangwa igihe icyumweru cyatangiraga",

    "field.closingOutstanding": "Amafaranga yari asigaye ataratangwa igihe icyumweru cyarangiraga",

    "field.reasonCategory": "Icyiciro cy’impamvu y’ibura ry’amafaranga",

    "field.explanation": "Ibisobanuro birambuye",

    "field.evidence": "Inyandiko cyangwa icyemezo kibihamya",

    "field.resolutionDate": "Itariki ikibazo giteganyijweho gukemukira",

    "field.overrideReason": "Impamvu y’uruhushya rwihariye rwo kudakurikiza inzira isanzwe",

    "field.provider": "Utanga serivisi y’ubwishyu",

    "field.reference": "Kode iranga ihererekanya ry’amafaranga",

    "field.amount": "Umubare w’amafaranga",

    "field.declaredSubmitted": "Amafaranga watanze muri iki cyumweru",

    "field.submissionFundingSource": "Ni nde wishyuye ikiguzi cya serivisi?",

    "field.datetime": "Itariki n’igihe",

    "field.senderPhone": "Nimero ya telefoni y’uwatanze amafaranga",

    "field.recipientPhone": "Nimero ya telefoni y’uwakiriye amafaranga",

    "field.confirmation": "Kode yemeza ubwishyu",

    "field.notes": "Icyitonderwa",

    "field.verification": "Igenzura",

    "field.comments": "Ibitekerezo",

    "field.original": "Ibyari byanditse mbere",

    "field.adjusted": "Ibyahinduwe",

    "action.generate": "Tegura raporo",

    "action.generateMine": "Tegura raporo yanjye y’icyumweru",

    "action.submit": "Ohereza raporo",

    "action.resubmit": "Ongera wohereze",

    "action.addMomo": "Ongeraho ihererekanya ry’amafaranga",

    "action.addCostPayment": "Andika ubwishyu wakoze ukoresheje amafaranga yawe bwite",

    "action.verifyCost": "Genzura ubwishyu bw’ikiguzi cya serivisi",

    "action.rejectCost": "Wange ubusabe bwo kwemeza ubwishyu bw’ikiguzi",

    "action.verify": "Genzura",

    "action.rejectTransfer": "Wange ihererekanya ry’amafaranga",

    "action.requestCorrection": "Saba ko raporo ikosorwa",

    "action.approve": "Emeza",

    "action.reject": "Wange",

    "action.adjust": "Andika ihinduka mu ibarura",

    "action.downloadPdf": "Kuramo PDF",

    "action.downloadExcel": "Kuramo Excel",

    "action.retry": "Ongera ugerageze",

    "status.draft": "Raporo y’agateganyo",

    "status.ready_for_submission": "Yiteguye koherezwa",

    "status.submitted": "Yoherejwe",

    "status.under_financial_review": "Irimo gusuzumwa n’abashinzwe imari",

    "status.returned_for_correction": "Yasubijwe kugira ngo ikosorwe",

    "status.approved": "Yemejwe",

    "status.rejected": "Yanzwe",

    "status.late": "Yarengeje igihe ntarengwa",

    "status.pending": "Iracyategereje",

    "status.auto_applied": "Byamaze gushyirwa mu ibarura; bizemezwa raporo yemejwe",

    "status.verified": "Byagenzuwe",

    "status.not_claimed": "Nta busabe bwatanzwe",

    "status.not_applicable": "Ntibikurikizwa",

    "status.missing": "Ntibyabonetse",

    "status.paid": "Byishyuwe",

    "status.partially_paid": "Byishyuwe igice",

    "status.unpaid": "Ntibirishyurwa",

    "status.cancelled": "Byahagaritswe",

    "status.refunded": "Amafaranga yasubijwe",

    "status.reversed": "Ihererekanya ryasubijwe inyuma",

    "status.yes": "Yego",

    "status.no": "Oya",

    "status.partial": "Igice gusa",

    "reason.customer_not_paid": "Umukiriya ntiyishyuye amafaranga yose",

    "reason.service_issue": "Habaye ikibazo kitari cyitezwe kijyanye na serivisi",

    "reason.payment_problem": "Ikibazo cy’ubwishyu",

    "reason.money_unavailable": "Amafaranga ntaraboneka by’agateganyo",

    "reason.incorrect_record": "Amakuru y’igikorwa yanditswe nabi",

    "reason.other": "Indi mpamvu",

    "error.shortage_explanation": "Ugomba gutanga impamvu n’ibisobanuro bigufi byumvikana.",

    "error.surplus_explanation": "Emeza amafaranga y’inyongera cyangwa usobanure impamvu yayo.",

    "error.shortage_evidence": "Iyo ugaragaje ko hari amafaranga abura, ugomba gutanga inyandiko cyangwa icyemezo kibihamya.",

    "error.unexplained_shortage": "Ntushobora kohereza raporo igaragaza ibura ry’amafaranga utatanze impamvu, keretse ufite uruhushya rwihariye rubikwemerera.",

    "error.duplicate_reference": "Iyi kode iranga ihererekanya ry’amafaranga isanzwe yarakoreshejwe.",

    "error.invalid_transition": "Iyi mpinduka ntiyemewe muri ubu buryo bwo gutunganya raporo.",

    "error.locked": "Raporo yamaze koherezwa ntishobora guhindurwa. Saba ko isubizwa kugira ngo uyikosore.",

    "error.shortage_resolution": "Ugomba kwandika itariki uteganya ko ikibazo cy’ibura ry’amafaranga kizakemukiraho.",

    "error.late_blocked": "Amabwiriza ariho ntiyemera kohereza raporo igihe ntarengwa cyarenze.",

    "error.claim_duplicate": "Iki kiguzi cya serivisi gisanzwe gifite ubusabe bwo kwemeza ko cyishyuwe.",

    "error.claim_invalid_amount": "Amafaranga wishyuye ku giti cyawe agomba kurenga zeru kandi ntarenze ikiguzi cya serivisi cyemewe.",

    "error.claim_reference_required": "Kode iranga ubwishyu irakenewe.",

    "error.claim_sender_required": "Nimero ya telefoni wakoresheje wishyura ikiguzi irakenewe.",

    "error.claim_evidence_required": "Ugomba gutanga icyemezo kigaragaza ko wishyuye ikiguzi cya serivisi ukoresheje amafaranga yawe bwite.",

    "error.claim_invalid_date": "Itariki wishyuriyeho igomba kuba iri muri iki cyumweru cya raporo.",

    "error.claim_not_personal": "Ikiguzi utishyuye ukoresheje amafaranga yawe bwite ntigishobora gukurwa ku mafaranga utegerejweho kohereza.",

    "error.invalid_week": "Icyumweru cya raporo kigomba gutangira ku Cyumweru, hakurikijwe igihe cya Kigali.",

    "notification.generated": "Raporo y’imari y’icyumweru cya {period} yarateguwe.",

    "notification.due": "Raporo y’imari y’icyumweru cya {period} igomba koherezwa uyu munsi saa {time}.",

    "notification.submitted": "Raporo y’imari y’icyumweru cya {period} yoherejwe na {agent}.",

    "notification.returned": "Raporo y’imari y’icyumweru cya {period} yasubijwe kugira ngo ikosorwe.",

    "notification.approved": "Raporo y’imari y’icyumweru cya {period} yemejwe.",

    "notification.rejected": "Raporo y’imari y’icyumweru cya {period} ntiyemewe.",

    "notification.shortage": "Muri raporo y’icyumweru cya {period} harimo ibura ry’amafaranga angana na {amount}.",

    "notification.submitted_ack": "Raporo yawe y’imari y’icyumweru cya {period} yoherejwe.",

    "notification.momo_verified": "Ihererekanya ry’amafaranga rifite kode {reference} ryagenzuwe: {status}.",

    "notification.cost_payment_submitted": "Ubusabe bwo kwemeza ko wishyuye ikiguzi cya serivisi ukoresheje amafaranga yawe bwite, bufite kode {reference} muri {period}, burategereje kugenzurwa.",

    "notification.cost_payment_verified": "Ubwishyu bw’ikiguzi cya serivisi bufite kode {reference} bwagenzuwe: {status}.",

    "notification.override_requested": "Uruhushya rwihariye rwo kudakurikiza inzira isanzwe rwatangiwe raporo y’icyumweru cya {period}.",

    "notification.late": "Igihe ntarengwa cyo kohereza raporo y’imari y’icyumweru cya {period} cyarenze.",

    "export.title": "Raporo y’imari y’umukozi utanga serivisi",

    "export.period": "Igihe raporo ireba",

    "export.generatedAt": "Yateguwe ku",

    "export.statementItem": "Ingingo ya raporo",

    "export.value": "Agaciro",

    "export.verifiedCalculation": "Ibarura ryagenzuwe",

    "export.component": "Ikigize raporo",

    "export.transaction": "Igikorwa",

    "export.customerPayment": "Amafaranga umukiriya yishyuye",

    "export.officialCosts": "Ibiciro byemewe bya serivisi",

    "export.personalPayment": "Amafaranga umukozi yishyuye akoresheje aye bwite",

    "export.deductibleAmount": "Amafaranga yemejwe agomba gukurwa ku yo kohereza",

    "statement.1": "Igihe raporo ireba n’umwirondoro w’umukozi utanga serivisi",

    "statement.2": "Amafaranga yari asigaye ataratangwa avuye mu cyumweru cyabanje",

    "statement.3": "Umubare w’ibikorwa byujuje ibisabwa",

    "statement.4": "Amafaranga yakiriwe ku bakiriya binyuze mu bikorwa byujuje ibisabwa",

    "statement.5": "Ibiciro byemewe bya serivisi n’amafaranga umukozi yishyuriye ku giti cye yagenzuwe",

    "statement.6": "Amafaranga yakiriwe kandi yemejwe muri iki cyumweru",

    "statement.7": "Amafaranga yishyuwe abatanga serivisi kandi yagenzuwe (harimo ibiciro umukozi yishyuye n’andi makosora)",

    "statement.8": "Amafaranga yemejwe yakoreshejwe mu mafaranga umukozi yakiriye ku bakiriya",

    "statement.9": "Amafaranga yasubijwe abakiriya mu buryo bwemewe",

    "statement.10": "Andi mafaranga yasohotse kandi yemejwe",

    "statement.11": "Komisiyo umukozi yagumanye (iyo iyi mikorere yashyizweho)",

    "statement.12": "Amafaranga umukozi ategerejweho kohereza",

    "statement.13": "Amafaranga umukozi yatangaje ko yohereje kuri MoMo cyangwa kuri banki",

    "statement.14": "Amafaranga umukozi yohereje, akagenzurwa kandi akemezwa n’uwasuzumye raporo",

    "statement.15": "Umubare w’amafaranga abura",

    "statement.16": "Umubare w’amafaranga asagutse",

    "statement.17": "Impamvu y’ibura ry’amafaranga, icyemezo kibihamya n’itariki biteganyijwe ko ikibazo kizakemukiraho",

    "statement.18": "Komisiyo umukozi yabonye (20% by’inyungu mbumbe; igaragazwa ukwabyo)",

    "statement.19": "Raporo zo gusoza umunsi zakozwe n’impushya zatanzwe zo kutazikora",

    "statement.20": "Amafaranga asigaye ataratangwa ajyanwa mu cyumweru gikurikira, hamwe n’amateka y’uko yagabanyijwe",

    "statement.21": "Imiterere ya raporo, ibyemezo byafashwe, amakosora yakozwe n’amateka y’ibikorwa byayikozweho",

    "ui.status.pending_payment": "Itegereje kwishyurwa",

    "ui.status.completed": "Byarangiye",

    "ui.status.failed": "Ntibyagenze neza",

    "ui.status.unverified": "Ntibiragenzurwa",

    "ui.status.rejected_transfer": "Ihererekanya ry’amafaranga ryanzwe",

    "ui.reason.customer_not_paid": "Umukiriya ntiyishyuye amafaranga yose",

    "ui.reason.service_issue": "Habaye ikibazo kitari cyitezwe kijyanye na serivisi",

    "ui.reason.payment_problem": "Ikibazo cy’ubwishyu",

    "ui.reason.money_unavailable": "Amafaranga ntaraboneka by’agateganyo",

    "ui.reason.incorrect_record": "Amakuru y’igikorwa yanditswe nabi",

    "ui.reason.cash_count_error": "Ikosa mu kubara amafaranga ari mu ntoki",

    "ui.reason.unrecorded_collection": "Amafaranga umukiriya yishyuye ntiyanditswe",

    "ui.reason.unapproved_expense": "Amafaranga yakoreshejwe atabanje kwemezwa",

    "ui.reason.provider_payment_timing": "Igihe ubwishyu bugomba gukorerwa utanga serivisi",

    "ui.reason.bank_delay": "Gukererwa kwa banki",

    "ui.reason.documentation_error": "Ikosa mu nyandiko cyangwa mu byangombwa",

    "ui.reason.other": "Ikindi",

    "ui.adjustment.authorized_receipt": "Amafaranga yakiriwe kandi yemejwe",

    "ui.adjustment.provider_payment": "Amafaranga yishyuwe utanga serivisi",

    "ui.adjustment.collection_expense": "Amafaranga yakoreshejwe mu yo abakiriya bishyuye",

    "ui.adjustment.authorized_refund": "Amafaranga yasubijwe umukiriya kandi byemejwe",

    "ui.adjustment.other_outflow": "Andi mafaranga yishyuwe asohoka",

    "ui.adjustment.commission_retained": "Komisiyo umukozi yagumanye",

    "ui.adjustment.outstanding_correction": "Gukosora amafaranga yari asigaye ataratangwa",

    "ui.adjustment.outstanding_waiver": "Gukuraho amafaranga yari asigaye ataratangwa",

    "ui.provider.momo": "MoMo",

    "ui.provider.bank_transfer": "Ihererekanya ry’amafaranga rinyuze muri banki",

    "ui.provider.cash_deposit": "Kubitsa amafaranga",

    "ui.tab.overview": "Incamake",

    "ui.tab.transactions": "Ibikorwa",

    "ui.tab.closings": "Raporo zo gusoza buri munsi",

    "ui.tab.expenses": "Amafaranga yakoreshejwe",

    "ui.tab.officialCosts": "Ibiciro byemewe bya serivisi",

    "ui.tab.momo": "MoMo",

    "ui.tab.shortage": "Ibura / Isaguka ry’amafaranga",

    "ui.tab.review": "Isuzuma",

    "ui.tab.audit": "Igenzura",

    "ui.list.title": "Raporo z’icyumweru",

    "ui.list.empty": "Nta raporo y’iki cyumweru iraboneka.",

    "ui.list.hint": "Hitamo icyumweru, hanyuma uhitemo raporo iri hasi kugira ngo urebe uko imibare y’amafaranga yahujwe.",

    "ui.queue.title": "Raporo zitegereje gusuzumwa",

    "ui.queue.empty": "Nta raporo zitegereje gusuzumwa.",

    "ui.queue.hint": "Aha hagaragara raporo zoherejwe, izirimo gusuzumwa n’izagaruwe kugira ngo zikosorwe.",

    "ui.filter.status": "Imiterere yose",

    "ui.filter.employee": "Abakozi bose batanga serivisi",

    "ui.filter.search": "Shakisha kode, serivisi cyangwa umukiriya",

    "ui.filter.service": "Serivisi zose",

    "ui.filter.paymentStatus": "Imiterere yose y’ubwishyu",

    "ui.filter.start": "Guhera",

    "ui.filter.end": "Kugeza",

    "ui.filter.reset": "Siba ibyo wahisemo mu kuyungurura",

    "ui.label.reportNumber": "Nimero ya raporo",

    "ui.label.period": "Igihe",

    "ui.label.submittedAt": "Yoherejwe ku",

    "ui.label.weekStart": "Itariki icyumweru gitangiriraho",

    "ui.label.weekEnd": "Itariki icyumweru kirangiriraho",

    "ui.label.reports": "raporo",

    "ui.label.details": "Ibisobanuro",

    "ui.label.view": "Reba",

    "ui.label.close": "Funga",

    "ui.label.save": "Bika raporo y’agateganyo",

    "ui.label.saving": "Birimo kubikwa…",

    "ui.label.cancel": "Hagarika",

    "ui.label.remove": "Kuraho",

    "ui.label.download": "Kuramo icyemezo kibihamya",

    "ui.label.noEvidence": "Nta nyandiko cyangwa icyemezo kibihamya cyashyizweho",

    "ui.label.none": "—",

    "ui.label.eligible": "Byujuje ibisabwa",

    "ui.label.notEligible": "Ntabwo byujuje ibisabwa",

    "ui.label.date": "Itariki",

    "ui.label.transaction": "Igikorwa",

    "ui.label.service": "Serivisi",

    "ui.label.client": "Umukiriya",

    "ui.label.price": "Igiciro umukiriya yishyura",

    "ui.label.cost": "Ikiguzi cya serivisi cyemewe",

    "ui.label.paid": "Amafaranga yishyuwe",

    "ui.label.grossProfit": "Inyungu mbumbe",

    "ui.label.commission": "Komisiyo",

    "ui.label.method": "Uburyo bwo kwishyura",

    "ui.label.export": "Sohora raporo",

    "ui.label.actions": "Ibikorwa",

    "ui.label.collections": "Amafaranga yakiriwe ku bakiriya",

    "ui.label.costs": "Ibiciro n’amafaranga yakoreshejwe",

    "ui.label.expected": "Ayateganyijwe",

    "ui.label.actual": "Ayabonetse",

    "ui.label.difference": "Itandukaniro",

    "ui.label.category": "Icyiciro",

    "ui.label.description": "Ibisobanuro",

    "ui.label.paymentSource": "Aho amafaranga yaturutse",

    "ui.label.receipt": "Inyemezabwishyu",

    "ui.label.approver": "Uwemeje",

    "ui.label.expectedCash": "Amafaranga yagombaga kuba ahari",

    "ui.label.missingNotice": "Iyo raporo yo gusoza umunsi itanditswe, ntibivuze ko amafaranga yari zeru. Bisobanura gusa ko nta raporo y’uwo munsi ihari.",

    "ui.label.overrideAuthorized": "Uruhushya rwihariye rwemejwe",

    "ui.label.overrideBy": "Byemejwe na",

    "ui.label.overrideAt": "Igihe byemejwe",

    "ui.label.missingOverride": "Kwemeza ko raporo yo gusoza umunsi itakozwe",

    "ui.label.statement": "Inyandiko igaragaza ibyakozwe kuri konti",

    "ui.label.item": "Nimero",

    "ui.label.value": "Agaciro",

    "ui.label.allocations": "Amateka y’uko amafaranga yari asigaye yagabanyijwe",

    "ui.label.adjustments": "Amakosora n’ihinduka byanditswe",

    "ui.label.auditAction": "Igikorwa",

    "ui.label.auditActor": "Uwagize icyo akora kuri raporo",

    "ui.label.auditWhen": "Igihe igikorwa cyakorewe",

    "ui.label.auditDetails": "Ibisobanuro",

    "ui.label.reviewNote": "Icyitonderwa cy’uwasuzumye raporo",

    "ui.label.correctionReason": "Impamvu yo gusaba ko raporo ikosorwa",

    "ui.label.rejectionReason": "Impamvu yo kwanga raporo",

    "ui.label.kind": "Ubwoko",

    "ui.label.label": "Izina",

    "ui.label.reason": "Impamvu",

    "ui.label.submissionNote": "Icyitonderwa ku mafaranga wohereje",

    "ui.label.weeklySubmission": "Amafaranga wohereje muri iki cyumweru",

    "ui.label.fundingSourceHelp": "Hitamo uwishyuye ayo mafaranga. Amafaranga umukozi yohereje agabanya ibura gusa iyo uwagenzuye raporo yayagenzuye akayemeza. Guhitamo “Telefoni yanjye” byonyine ntibihamya ko ari wowe wishyuye.",

    "ui.source.agent_phone": "Telefoni yanjye",

    "ui.source.company": "Ikigo",

    "ui.source.someone_else": "Undi muntu",

    "ui.label.evidenceHelp": "Amadosiye yemerewe: PDF, PNG, JPG cyangwa WEBP. Ingano ntarengwa ni 10 MB.",

    "ui.label.expenseNote": "Amafaranga yakoreshejwe avuye mu yo abakiriya bishyuye agabanya amafaranga utegerejweho kohereza ari uko yemejwe kandi akabarwa muri raporo.",

    "ui.label.costPaymentNote": "Uko umukiriya yishyuye ntibigaragaza uwatanze amafaranga yo kwishyura ikiguzi cya serivisi. Iyo uhisemo ko ari wowe wishyuye ukoresheje amafaranga yawe bwite, ikiguzi cyose gihita gikurwa ku yo utegerejweho kohereza. Icyo gikorwa cyemezwa burundu raporo yemejwe. Ubusabe wanditse ku giti cyawe bugomba kubanza kugenzurwa n’uwasuzumye raporo.",

    "ui.label.costPaymentSummary": "Ubusabe bwo kwemeza ko umukozi yishyuriye ikiguzi cya serivisi ku mafaranga ye bwite",

    "ui.label.costPaymentRecorded": "Ubusabe bwo kwemeza ubwishyu bw’ikiguzi cya serivisi bwanditswe.",

    "ui.label.costPaymentRemoved": "Ubusabe bwo kwemeza ubwishyu bw’ikiguzi cya serivisi bwakuweho.",

    "ui.label.selectCostTransaction": "Hitamo igikorwa kugira ngo werekane uwishyuye ikiguzi cya serivisi cyemewe.",

    "ui.label.personalPaymentNo": "Oya, cyishyuwe n’ikigo cyangwa n’undi muntu.",

    "ui.label.personalPaymentYes": "Yego, nishyuriyeho nkoresheje amafaranga yanjye bwite.",

    "ui.label.costVerificationNote": "Icyitonderwa cy’uwasuzumye raporo",

    "ui.label.partialPayment": "Ubwishyu bw’igice cy’amafaranga",

    "ui.label.deductibleAmount": "Amafaranga agomba gukurwa ku yo kohereza",

    "ui.label.shortageNote": "Iyi mibare yabaruwe na sisitemu. Ntabwo yongeye kubarirwa kuri iyi paji.",

    "ui.label.verifiedTotal": "Amafaranga yoherejwe yagenzuwe kandi yemejwe ni yo akoreshwa mu kubara ibura cyangwa isaguka ry’amafaranga.",

    "ui.label.generating": "Birimo gutegurwa…",

    "ui.label.loading": "Birimo kuzana amakuru…",

    "ui.label.loadingWeeks": "Birimo kuzana ibyumweru…",

    "ui.label.records": "ibyanditswe",

    "ui.label.pageOf": "Urupapuro {page} kuri {pages}",

    "ui.label.backToQueue": "Subira ku rutonde",

    "ui.label.openWorkspace": "Fungura ahakorerwa raporo",

    "ui.label.submitWeekly": "Ohereza raporo y’icyumweru",

    "ui.label.reviewWorkspace": "Ahakorerwa isuzuma rya raporo",

    "ui.label.allWeeks": "Ibyumweru byose",

    "ui.label.allBranches": "Amashami yose",

    "ui.label.report": "Raporo",

    "ui.label.saved": "Raporo y’agateganyo yabitswe.",

    "ui.label.submitted": "Raporo yoherejwe.",

    "ui.label.momoAdded": "Ihererekanya ry’amafaranga ryashyizwe muri raporo.",

    "ui.label.momoRemoved": "Ihererekanya ry’amafaranga ryakuwe muri raporo.",

    "ui.label.reviewRecorded": "Igikorwa cy’isuzuma cyanditswe.",

    "ui.label.adjustmentRecorded": "Ihinduka mu ibarura ry’amafaranga ryanditswe.",

    "ui.label.overrideRecorded": "Uruhushya rwihariye rwatanzwe kandi rwanditswe.",

    "ui.label.generated": "Raporo z’icyumweru zateguwe.",

    "nav.weeklyWorkspace": "Raporo z’icyumweru",

    "page.workspace.title": "Raporo z’imari z’icyumweru",

    "page.workspace.subtitle": "Genzura amafaranga, ukemure ibibazo bidasanzwe kandi wandike ibyemezo ahantu hamwe.",

    "ui.mode.review": "Zikeneye gusuzumwa",

    "ui.mode.all": "Raporo zose",

    "ui.filter.branch": "Ishami",

    "ui.filter.searchReports": "Shakisha raporo",

    "ui.filter.shortageOnly": "Raporo zifite ibura ry’amafaranga",

    "ui.filter.pendingOnly": "Igenzura ritararangira",

    "ui.filter.unverifiedOnly": "Amafaranga ataragenzurwa",

    "ui.filter.missingClosings": "Raporo zo gusoza umunsi zitabonetse",

    "ui.metric.reviewQueue": "Raporo zitegereje icyemezo",

    "ui.metric.shortage": "Raporo zifite ibura ry’amafaranga",

    "ui.metric.pending": "Igenzura ritararangira",

    "ui.metric.unverified": "Amafaranga ataragenzurwa",

    "ui.metric.missing": "Raporo zo gusoza umunsi zitabonetse",

    "ui.metric.total": "Raporo ziri mu byo usuzuma",

    "ui.list.report": "Raporo",

    "ui.list.agent": "Umukozi / ishami",

    "ui.list.signals": "Ibimenyetso byerekana ibikeneye gusuzumwa",

    "ui.label.reviewReport": "Suzuma raporo",

    "ui.label.openReport": "Fungura raporo",

    "ui.label.clearAll": "Kuraho byose",

    "ui.label.selectedFilters": "uduyunguruzo twashyizweho",

    "review.title": "Isuzuma rya raporo",

    "review.subtitle": "Hagaragazwa gusa imibare yagenzuwe na sisitemu. Amafaranga yoherejwe kandi akagenzurwa ni yo yonyine agabanya ibura ry’amafaranga.",

    "review.section.financial": "Uko imari ihagaze",

    "review.section.reconciliation": "Guhuza imibare y’amafaranga",

    "review.section.officialCosts": "Ibiciro byemewe bya serivisi",

    "review.section.momo": "Amafaranga yoherejwe",

    "review.section.shortage": "Gusuzuma ibura cyangwa isaguka ry’amafaranga",

    "review.section.closings": "Incamake ya buri munsi",

    "review.section.decision": "Icyemezo cy’isuzuma",

    "review.section.audit": "Amateka y’ibyemezo",

    "review.expected": "Amafaranga ategerejwe koherezwa",

    "review.verified": "Amafaranga yoherejwe yagenzuwe kandi yemezwa",

    "review.declared": "Amafaranga yatangajwe n’umukozi",

    "review.verifiedGap": "Itandukaniro ryagaragaye mu mibare yagenzuwe",

    "review.declaredGap": "Itandukaniro ryatangajwe n’umukozi",

    "review.verificationHelp": "Amafaranga ategerejwe koherezwa agabanywa gusa n’ihererekanya ryagenzuwe, hamwe n’ibiguzi umukozi yishyuriye ku mafaranga ye bwite byagenzuwe cyangwa byemejwe binyuze mu mahitamo yatanze muri sisitemu.",

    "review.pendingBadge": "Biracyategereje kugenzurwa",

    "review.noClaims": "Nta busabe bwo kwemeza ko umukozi yishyuriye ikiguzi cya serivisi ku mafaranga ye bwite buhari.",

    "review.noTransfers": "Nta ihererekanya ry’amafaranga ryanditswe.",

    "review.evidence": "Inyandiko cyangwa icyemezo kibihamya",

    "review.decisionReason": "Impamvu cyangwa icyitonderwa cy’isuzuma",

    "review.approveHelp": "Kwemeza raporo bituma itongera guhindurwa, kandi amafaranga asigaye ataratangwa ajyanwa mu cyumweru gikurikira.",

    "review.returnHelp": "Mbere y’uko umukozi akosora raporo akongera akayohereza, agomba kubanza guhabwa impamvu isobanutse.",

    "review.rejectHelp": "Ugomba gutanga impamvu isobanutse kugira ngo wange iyi raporo.",

    "review.notDecisionStatus": "Iyi raporo yarafunzwe; nta kindi cyemezo gishobora kuyifatwaho.",

    "review.dailyMissing": "Nta raporo yo gusoza umunsi yakozwe.",

    "review.branchScope": "Umuyobozi ashobora kubona raporo z’ishami ashinzwe gusa.",

    "review.overviewTab": "Incamake",

    "review.officialTab": "Ibiciro byemewe bya serivisi",

    "review.momoTab": "Ihererekanya ry’amafaranga",

    "review.closingsTab": "Buri munsi",

    "review.auditTab": "Igenzura",

    "review.recommendation": "Uko igenzura rihagaze",

    "review.openEvidence": "Fungura inyandiko cyangwa icyemezo kibihamya",

    "review.agentAnswer": "Ibisobanuro byatanzwe n’umukozi",

    "review.authorizedOverride": "Uruhushya rwihariye rwo kudakurikiza inzira isanzwe",

    "review.completed": "Icyemezo cyanditswe.",

    "review.actionFailed": "Ntibyashobotse kurangiza iki gikorwa.",

    "review.transferVerified": "Ihererekanya ry’amafaranga ryagenzuwe kandi ryemezwa.",

    "review.costVerified": "Ubwishyu bw’ikiguzi umukozi yakoze ku mafaranga ye bwite bwaragenzuwe.",

    "review.returned": "Raporo yasubijwe kugira ngo ikosorwe.",

    "review.approved": "Raporo yemejwe.",

    "review.rejected": "Raporo yanzwe.",

    "notification.openReport": "Fungura raporo y’icyumweru",

    "ui.error.required": "Iki gice ni ngombwa kukuzuza.",

    "ui.error.referenceRequired": "Ugomba kwandika kode iranga ihererekanya ry’amafaranga.",

    "ui.error.referenceShort": "Kode igomba kuba ifite nibura inyuguti 4.",

    "ui.error.amountRequired": "Andika umubare w’amafaranga urenze zeru.",

    "ui.error.evidenceType": "Inyandiko cyangwa icyemezo gihamya bigomba kuba biri muri dosiye ya PDF, PNG, JPG cyangwa WEBP.",

    "ui.error.evidenceSize": "Ingano ya dosiye ntigomba kurenga 10 MB.",

    "ui.error.overrideDisabled": "Amabwiriza ntiyemera gutanga uruhushya rwo kudakurikiza inzira isanzwe.",

    "ui.error.exportFailed": "Raporo ntiyashoboye gutegurwa ngo ikururwe.",

    "ui.error.loadFailed": "Amakuru ya raporo ntiyashoboye kuboneka.",

    "ui.error.accessDenied": "Nta burenganzira ufite bwo kureba iyi raporo y’icyumweru.",

    "ui.agent.title": "Raporo yanjye y’icyumweru",

    "ui.agent.subtitle": "Emeza ibiciro bya serivisi, utangaze amafaranga wohereje, hanyuma wohereze raporo.",

    "ui.agent.step.summary": "1. Incamake y’icyumweru cyawe",

    "ui.agent.step.costs": "2. Emeza uwishyuye ibiciro bya serivisi",

    "ui.agent.step.submit": "3. Tangaza amafaranga wohereje, hanyuma wohereze raporo",

    "ui.agent.expected": "Amafaranga ugomba kohereza",

    "ui.agent.loadingWeek": "Birimo kuzana imibare y’iki cyumweru…",

    "ui.agent.declared": "Amafaranga watangaje ko wohereje",

    "ui.agent.evidenceBacked": "Afite inyandiko cyangwa ibindi bimenyetso biyahamya",

    "ui.agent.verifiedReceived": "Yagenzuwe kandi yemezwa ko yakiriwe",

    "ui.agent.viewDetails": "Reba ibisobanuro",

    "ui.agent.detailsTitle": "Uko amafaranga utegerejweho kohereza abarwa",

    "ui.agent.collections": "Amafaranga wakiriye ku bakiriya",

    "ui.agent.previousOutstanding": "Amafaranga wari usigaje utaratanga mu mpera z’icyumweru gishize",

    "ui.agent.officialCosts": "Ibiciro byemewe bya serivisi",

    "ui.agent.verifiedCredits": "Ibiciro bya serivisi wishyuye ukoresheje amafaranga yawe bwite kandi bikagenzurwa",

    "ui.agent.appliedCredits": "Ibiciro wishyuye ukoresheje amafaranga yawe bwite bimaze gukurwa ku yo ugomba kohereza",

    "ui.agent.pendingCredits": "Ubusabe bwawe bwo kwemeza ubwishyu buracyategereje gusuzumwa",

    "ui.agent.companyPaid": "Yishyuwe na AfriTech Bridge",

    "ui.agent.someoneElsePaid": "Yishyuwe n’undi muntu",

    "ui.agent.notPaid": "Ntikirishyurwa",

    "ui.agent.transactions": "Ibikorwa byujuje ibisabwa",

    "ui.agent.costIntro": "Kuri buri gikorwa, hitamo uwishyuye ikiguzi cya serivisi. Iyo uhisemo ko ari wowe wishyuye ukoresheje amafaranga yawe bwite, ikiguzi cyose gihita gikurwa ku mafaranga utegerejweho kohereza. Icyo kiguzi cyemezwa burundu raporo y’icyumweru imaze kwemezwa.",

    "ui.agent.costPersonalAuto": "Nta bindi bisobanuro bisabwa. Sisitemu ikoresha umwirondoro wawe n’amakuru y’iki gikorwa, ikandika ko wishyuye ikiguzi cyose cya serivisi. Ikiguzi gihita gikurwa ku mafaranga utegerejweho kohereza, ariko kikemezwa burundu raporo yemejwe.",

    "ui.agent.costErrorTitle": "Igisubizo nticyabitswe",

    "ui.agent.costErrorRetry": "Ongera ugerageze",

    "ui.agent.errorSummaryTitle": "Kosora ibi bikurikira:",

    "ui.agent.costAutoCompany": "Byemejwe mu buryo bwikora: ikiguzi cyishyuwe na AfriTech Bridge",

    "ui.agent.costAutoCompanyNote": "Ibiciro bya serivisi zijyanye n’inyandiko z’ubutaka byishyuwe na AfriTech Bridge biba byaramaze kwemezwa, ni yo mpamvu bitagaragara kuri uru rutonde. Ntibigabanywa ku mafaranga utegerejweho kohereza.",

    "ui.agent.costAutoAppliedNote": "Aya mafaranga yamaze gukurwa ku yo utegerejweho kohereza. Ibyo byemezwa burundu raporo y’icyumweru imaze kwemezwa.",

    "ui.agent.costSource.personal": "Nishyuye nkoresheje amafaranga yanjye bwite",

    "ui.agent.costSource.company": "AfriTech Bridge ni yo yishyuye",

    "ui.agent.costSource.someone_else": "Undi muntu ni we wishyuye",

    "ui.agent.costSource.not_paid": "Ntikirishyurwa",

    "ui.agent.saveAnswer": "Bika igisubizo",

    "ui.agent.changeAnswer": "Hindura igisubizo",

    "ui.agent.costSaving": "Igisubizo kirimo kubikwa…",

    "ui.agent.costPersonalDetails": "Ibisobanuro by’ubwishyu wakoze",

    "ui.agent.costPending": "Ubusabe bwo kwishyura ukoresheje amafaranga yawe bwite buracyategereje kugenzurwa. Nta mafaranga azakurwa ku yo ugomba kohereza kugeza igihe ubwo busabe bwemejwe.",

    "ui.agent.costApplied": "Amafaranga amaze gukurwa ku yo ugomba kohereza: {amount} RWF. Iri gabanywa rizemezwa burundu raporo imaze kwemezwa.",

    "ui.agent.costVerified": "Amafaranga yakuwe ku yo ugomba kohereza kandi akagenzurwa: {amount} RWF",

    "ui.agent.costNoDeduction": "Nta mafaranga akurwa ku yo utegerejweho kohereza",

    "ui.agent.amountPrompt": "Ni angahe wohereje muri iki cyumweru?",

    "ui.agent.amountInRwf": "Umubare w’amafaranga muri RWF",

    "ui.agent.compare.equal": "Amafaranga watangaje ahwanye n’ategerejwe. Nta bisobanuro bisabwa.",

    "ui.agent.compare.less": "Harabura {amount} RWF kugira ngo amafaranga utegerejweho kohereza yuzure. Sobanura impamvu.",

    "ui.agent.compare.zero": "Watangaje ko nta mafaranga wohereje. Sobanura impamvu.",

    "ui.agent.compare.more": "Wohereje {amount} RWF arenze ayo wari utegerejweho. Sobanura impamvu.",

    "ui.agent.reason": "Impamvu",

    "ui.agent.explanation": "Ibisobanuro bigufi",

    "ui.agent.addTransfer": "Ongeraho ihererekanya ry’amafaranga",

    "ui.agent.addAnother": "Ongeraho irindi hererekanya ry’amafaranga",

    "ui.agent.transferDetails": "Ibisobanuro by’ihererekanya (si ngombwa, ariko birafasha)",

    "ui.agent.removeTransfer": "Kuraho ihererekanya ry’amafaranga",

    "ui.agent.quickReview": "Isuzuma rya nyuma mbere yo kohereza",

    "ui.agent.reviewCosts": "Ibiciro byemewe bya serivisi byemejwe",

    "ui.agent.reviewTransfers": "Ihererekanya ry’amafaranga wongeyeho",

    "ui.agent.submit": "Ohereza raporo y’icyumweru",

    "ui.agent.success": "Raporo yoherejwe",

    "ui.agent.successDetail": "Raporo yawe y’icyumweru yoherejwe ku muntu ushinzwe gusuzuma imari.",

    "ui.agent.error.money": "Andika umubare w’amafaranga muri RWF ukoresheje imibare gusa.",

    "ui.agent.error.reason": "Hitamo impamvu kandi utange ibisobanuro bigufi.",

    "ui.agent.error.surplus": "Sobanura muri make impamvu wohereje amafaranga arenga ayari ateganyijwe.",

    "ui.agent.error.costAmount": "Andika umubare urenze zeru kandi utarenze ikiguzi cya serivisi cyemewe.",

    "ui.agent.error.reference": "Kode iranga ihererekanya igomba kuba ifite nibura inyuguti 4.",

    "ui.agent.error.transferAmount": "Andika umubare w’amafaranga wohereje urenze zeru.",

    "ui.agent.error.transferDate": "Hitamo itariki iri muri iki cyumweru cya raporo cyangwa itariki ibanziriza igihe ntarengwa cyo kohereza.",

  },

};



export function normalizeWeeklyLang(value?: string | null): WeeklyLang {

  return value?.toLowerCase() === 'rw' ? 'rw' : 'en';

}



/** Same interpolation semantics as backend t(key, lang, **kwargs). */

export function translateWeekly(

  key: string,

  lang: WeeklyLang = 'en',

  vars?: Record<string, string | number>

): string {

  const translated = LABELS[normalizeWeeklyLang(lang)]?.[key] ?? LABELS.en[key] ?? key;



  return translated.replace(/\{(\w+)\}/g, (match, name: string) =>

    vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match

  );

}



export function weeklyStatusLabel(status?: string | null, lang: WeeklyLang = 'en'): string {

  if (!status) return '—';



  return translateWeekly(`status.${status}`, lang) !== `status.${status}`

    ? translateWeekly(`status.${status}`, lang)

    : translateWeekly(`ui.status.${status}`, lang) !== `ui.status.${status}`

      ? translateWeekly(`ui.status.${status}`, lang)

      : status.replace(/_/g, ' ');

}



const WEEKLY_NOTIFICATION_TYPES = new Set([

  'weekly_report_generated',

  'weekly_report_due',

  'weekly_report_late',

  'weekly_report_submitted',

  'weekly_report_submitted_ack',

  'weekly_report_returned',

  'weekly_report_approved',

  'weekly_report_rejected',

  'weekly_report_shortage',

  'weekly_momo_verified',

  'weekly_override_requested',

]);



export function isWeeklyNotificationType(type?: string | null): boolean {

  return !!type && WEEKLY_NOTIFICATION_TYPES.has(type);

}



/**

 * Weekly notifications are stored by the backend as "English / Kinyarwanda".

 * Pick the half matching the current UI language. Non-weekly text is never

 * touched, and user-authored values embedded in the template stay verbatim.

 */

export function localizedWeeklyMessage(

  message: string | null | undefined,

  lang: WeeklyLang = 'en'

): string {

  if (!message) return '';



  const parts = message.split(/\s+\/\s+/);

  if (parts.length < 2) return message;



  return lang === 'rw' ? parts[parts.length - 1] : parts[0];

}



/**

 * Weekly notifications already carry the report id. Send the user straight to

 * the report workspace instead of the generic inbox; all other notification

 * types keep their existing destination.

 */

export function weeklyNotificationHref(notification?: {

  related_type?: string | null;

  related_id?: number | null;

} | null, fallback = '/notifications'): string {

  const id = Number(notification?.related_id);

  if (notification?.related_type === 'weekly_report' && Number.isInteger(id) && id > 0) {

    return `/finance/weekly-reports?report=${id}&tab=overview`;

  }

  return fallback;

}



/**

 * One store shared by every hook instance: the header switcher, the sidebar

 * and each open report all change language together, without a route change

 * (so unsaved form values survive the switch).

 */

let currentLang: WeeklyLang = 'en';

let storageLoaded = false;

const langListeners = new Set<() => void>();



function emitLang() {

  langListeners.forEach((listener) => listener());

}



function loadStoredLang() {

  if (storageLoaded || typeof window === 'undefined') return;



  storageLoaded = true;

  try {

    const saved = window.localStorage.getItem(WEEKLY_LANG_STORAGE_KEY);

    const value = normalizeWeeklyLang(saved);



    if (value !== currentLang) {

      currentLang = value;

      emitLang();

    }

  } catch {

    // Private browsing / disabled storage: stay on the default language.

  }

}



function subscribeLang(listener: () => void) {

  langListeners.add(listener);

  return () => {

    langListeners.delete(listener);

  };

}



function getLangSnapshot(): WeeklyLang {

  return currentLang;

}



function getServerLangSnapshot(): WeeklyLang {

  return 'en';

}



export function useWeeklyI18n() {

  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getServerLangSnapshot);



  useEffect(() => {

    loadStoredLang();

  }, []);



  const setLang = useCallback((next: WeeklyLang | string) => {

    const value = normalizeWeeklyLang(next);



    if (value !== currentLang) {

      currentLang = value;

      emitLang();

    }



    try {

      window.localStorage.setItem(WEEKLY_LANG_STORAGE_KEY, value);

    } catch {

      // Language still changes for this session even without persistence.

    }

  }, []);



  const t = useCallback(

    (key: string, vars?: Record<string, string | number>) => translateWeekly(key, lang, vars),

    [lang]

  );



  const statusLabel = useCallback(

    (status?: string | null) => weeklyStatusLabel(status, lang),

    [lang]

  );



  return { lang, setLang, t, statusLabel };

}



/** A visible [ EN ] [ RW ] control. Switching never reloads or resets state. */

export function WeeklyLangSwitcher({ className = '' }: { className?: string }) {

  const { lang, setLang, t } = useWeeklyI18n();



  return (

    <div className={`d-flex align-items-center gap-2 ${className}`}>

      <span className="small text-muted">{t('switcher.label')}</span>

      <div className="btn-group btn-group-sm" role="group" aria-label={t('switcher.label')}>

        {(['en', 'rw'] as WeeklyLang[]).map((code) => (

          <button

            key={code}

            type="button"

            className={`btn ${lang === code ? 'btn-primary' : 'btn-outline-secondary'}`}

            aria-pressed={lang === code}

            onClick={() => setLang(code)}

          >

            [ {code.toUpperCase()} ]

          </button>

        ))}

      </div>

    </div>

  );

}
