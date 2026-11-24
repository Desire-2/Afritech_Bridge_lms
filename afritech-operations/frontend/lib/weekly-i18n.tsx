'use client';

/**
 * Bilingual labels for the weekly financial report UI.
 *
 * The `en`/`rw` dictionaries below deliberately mirror
 * `backend/app/services/weekly_i18n.py` key-for-key and word-for-word, so an
 * export produced with `?lang=rw` and a screen rendered with RW stay in sync.
 * Only system labels, statuses, validation messages and notification templates
 * live here — user-entered text is always displayed exactly as supplied.
 * Keys prefixed `ui.` are screen-only labels that the backend does not render.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type WeeklyLang = 'en' | 'rw';

export const WEEKLY_LANG_STORAGE_KEY = 'abops_weekly_lang';

const LABELS: Record<WeeklyLang, Record<string, string>> = {
  en: {
    'nav.weeklyReports': 'Weekly Financial Report',
    'nav.weeklyReview': 'Weekly Report Review',
    'page.title': 'Weekly Service Agent Financial Report',
    'page.subtitle': 'Reconciliation, money submission and financial review',
    'switcher.label': 'Language',
    'period.current': 'Current week',
    'period.previous': 'Previous week',
    'period.select': 'Select week',
    'section.overview': 'Financial overview',
    'section.transactions': 'Weekly transactions',
    'section.closings': 'Daily closings',
    'section.expenses': 'Approved expenses',
    'section.officialCosts': 'Official service cost payments',
    'section.momo': 'Money submissions',
    'section.shortage': 'Shortage / surplus',
    'section.review': 'Financial review',
    'section.audit': 'Audit history',
    'field.agent': 'Service Agent',
    'field.week': 'Week',
    'field.due': 'Submission deadline',
    'field.status': 'Status',
    'field.transactionCount': 'Transaction count',
    'field.collections': 'Customer collections',
    'field.serviceCosts': 'Service costs',
    'field.costPaymentStatus': 'Customer payment status',
    'field.officialCostPaymentStatus': 'Official cost verification',
    'field.personalPayment': 'Paid from own funds?',
    'field.personalPaidAmount': 'Amount paid personally',
    'field.paymentProvider': 'Payment provider',
    'field.paidAt': 'Payment date & time',
    'field.reviewerDecision': 'Reviewer decision',
    'field.authorizedReceipts': 'Authorized receipts',
    'field.providerPayments': 'Verified provider payments',
    'field.approvedExpenses': 'Approved collection-funded expenses',
    'field.refunds': 'Authorized refunds',
    'field.otherOutflows': 'Other approved cash outflows',
    'field.commissionRetained': 'Commission retained',
    'field.expectedRemittance': 'Expected remittance',
    'field.agentReported': 'Agent-reported submissions',
    'field.verifiedSubmitted': 'Verified money submissions',
    'field.shortage': 'Shortage',
    'field.surplus': 'Surplus',
    'field.commissionEarned': 'Commission earned',
    'field.openingOutstanding': 'Opening outstanding balance',
    'field.closingOutstanding': 'Closing outstanding balance',
    'field.reasonCategory': 'Shortage reason category',
    'field.explanation': 'Detailed explanation',
    'field.evidence': 'Evidence',
    'field.resolutionDate': 'Expected resolution date',
    'field.overrideReason': 'Authorized override reason',
    'field.provider': 'Provider',
    'field.reference': 'Reference',
    'field.amount': 'Amount',
    'field.datetime': 'Date & time',
    'field.senderPhone': 'Sender phone',
    'field.recipientPhone': 'Recipient phone',
    'field.confirmation': 'Confirmation code',
    'field.notes': 'Notes',
    'field.verification': 'Verification',
    'field.comments': 'Comments',
    'field.original': 'Original',
    'field.adjusted': 'Adjusted',
    'action.generate': 'Generate report',
    'action.submit': 'Submit report',
    'action.resubmit': 'Resubmit',
    'action.addMomo': 'Add submission',
    'action.addCostPayment': 'Record personal payment',
    'action.verifyCost': 'Verify cost payment',
    'action.rejectCost': 'Reject cost payment',
    'action.verify': 'Verify',
    'action.rejectTransfer': 'Reject transfer',
    'action.requestCorrection': 'Request correction',
    'action.approve': 'Approve',
    'action.reject': 'Reject',
    'action.adjust': 'Record adjustment',
    'action.downloadPdf': 'Download PDF',
    'action.downloadExcel': 'Download Excel',
    'action.retry': 'Retry',
    'status.draft': 'Draft',
    'status.ready_for_submission': 'Ready for Submission',
    'status.submitted': 'Submitted',
    'status.under_financial_review': 'Under Financial Review',
    'status.returned_for_correction': 'Returned for Correction',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.late': 'Late',
    'status.pending': 'Pending',
    'status.verified': 'Verified',
    'status.not_claimed': 'Not claimed',
    'status.not_applicable': 'Not applicable',
    'status.missing': 'Missing',
    'status.paid': 'Paid',
    'status.partially_paid': 'Partially Paid',
    'status.unpaid': 'Unpaid',
    'status.cancelled': 'Cancelled',
    'status.refunded': 'Refunded',
    'status.reversed': 'Reversed',
    'status.yes': 'Yes',
    'status.no': 'No',
    'status.partial': 'Partial',
    'error.shortage_explanation': 'A detailed shortage explanation is required.',
    'error.shortage_evidence': 'Evidence is required when a shortage is reported.',
    'error.unexplained_shortage': 'A shortage cannot be submitted without an authorized override reason.',
    'error.duplicate_reference': 'That money submission reference already exists.',
    'error.invalid_transition': 'This workflow transition is not allowed.',
    'error.locked': 'A submitted report is locked; request a correction instead.',
    'error.shortage_resolution': 'An expected resolution date is required for a shortage.',
    'error.late_blocked': 'Late submissions are blocked by the current reporting policy.',
    'error.claim_duplicate': 'This official cost already has a payment claim.',
    'error.claim_invalid_amount': 'The personally paid amount must be positive and not exceed the official cost.',
    'error.claim_reference_required': 'A payment reference is required.',
    'error.claim_sender_required': 'The phone used to pay the cost is required.',
    'error.claim_evidence_required': 'Evidence is required for a personal cost payment.',
    'error.claim_invalid_date': 'The payment date must fall within the reporting week.',
    'error.claim_not_personal': 'A cost not paid from the agent’s own funds cannot be deducted.',
    'error.invalid_week': 'A reporting week must start on Sunday in Africa/Kigali.',
    'notification.generated': 'Weekly financial report {period} has been generated.',
    'notification.due': 'Weekly financial report {period} is due today at {time}.',
    'notification.submitted': 'Weekly financial report {period} was submitted by {agent}.',
    'notification.returned': 'Weekly financial report {period} was returned for correction.',
    'notification.approved': 'Weekly financial report {period} was approved.',
    'notification.rejected': 'Weekly financial report {period} was rejected.',
    'notification.shortage': 'Weekly report {period} has a shortage of {amount}.',
    'notification.submitted_ack': 'Your weekly financial report {period} was submitted.',
    'notification.momo_verified': 'Money submission {reference} was {status}.',
    'notification.cost_payment_submitted': 'Personal payment {reference} for an official cost in {period} awaits verification.',
    'notification.cost_payment_verified': 'Official cost payment {reference} was {status}.',
    'notification.override_requested': 'An override was authorised for weekly report {period}.',
    'notification.late': 'Weekly financial report {period} is now late.',
    'export.title': 'Weekly Service Agent Financial Report',
    'export.period': 'Reporting period',
    'export.generatedAt': 'Generated at',
    'export.statementItem': 'Statement item',
    'export.value': 'Value',
    'export.verifiedCalculation': 'Verified Calculation',
    'export.component': 'Component',
    'export.transaction': 'Transaction',
    'export.customerPayment': 'Customer payment',
    'export.officialCosts': 'Official service costs',
    'export.personalPayment': 'Personal payment',
    'export.deductibleAmount': 'Verified deductible amount',
    'statement.1': 'Reporting period and agent identity',
    'statement.2': 'Opening outstanding balance brought forward',
    'statement.3': 'Eligible transaction count',
    'statement.4': 'Customer collections from eligible transactions',
    'statement.5': 'Official service costs and verified personal payments',
    'statement.6': 'Authorized receipts during the week',
    'statement.7': 'Verified provider payments (agent-funded costs + adjustments)',
    'statement.8': 'Approved collection-funded expenses',
    'statement.9': 'Authorized refunds',
    'statement.10': 'Other approved cash outflows',
    'statement.11': 'Commission retained (only if configured)',
    'statement.12': 'Expected remittance / expected submission',
    'statement.13': 'Agent-reported MoMo/bank submissions',
    'statement.14': 'Reviewer-verified money submissions',
    'statement.15': 'Shortage amount',
    'statement.16': 'Surplus amount',
    'statement.17': 'Shortage reason, evidence and resolution date',
    'statement.18': 'Commission earned (20% of gross profit, shown separately)',
    'statement.19': 'Daily closing coverage and missing-closing overrides',
    'statement.20': 'Outstanding balance carried forward with allocation history',
    'statement.21': 'Workflow state, approvals, adjustments and audit trail',
    // Screen-only keys (the backend does not render these strings).
    'ui.status.pending_payment': 'Pending Payment',
    'ui.status.completed': 'Completed',
    'ui.status.failed': 'Failed',
    'ui.status.unverified': 'Unverified',
    'ui.status.rejected_transfer': 'Rejected transfer',
    'ui.reason.cash_count_error': 'Cash count error',
    'ui.reason.unrecorded_collection': 'Unrecorded collection',
    'ui.reason.unapproved_expense': 'Unapproved expense',
    'ui.reason.provider_payment_timing': 'Provider payment timing',
    'ui.reason.bank_delay': 'Bank delay',
    'ui.reason.documentation_error': 'Documentation error',
    'ui.reason.other': 'Other',
    'ui.adjustment.authorized_receipt': 'Authorized receipt',
    'ui.adjustment.provider_payment': 'Provider payment',
    'ui.adjustment.collection_expense': 'Collection expense',
    'ui.adjustment.authorized_refund': 'Authorized refund',
    'ui.adjustment.other_outflow': 'Other outflow',
    'ui.adjustment.commission_retained': 'Commission retained',
    'ui.adjustment.outstanding_correction': 'Outstanding correction',
    'ui.adjustment.outstanding_waiver': 'Outstanding waiver',
    'ui.provider.momo': 'MoMo',
    'ui.provider.bank_transfer': 'Bank transfer',
    'ui.provider.cash_deposit': 'Cash deposit',
    'ui.tab.overview': 'Overview',
    'ui.tab.transactions': 'Transactions',
    'ui.tab.closings': 'Daily closings',
    'ui.tab.expenses': 'Expenses',
    'ui.tab.officialCosts': 'Official costs',
    'ui.tab.momo': 'MoMo',
    'ui.tab.shortage': 'Shortage / Surplus',
    'ui.tab.review': 'Review',
    'ui.tab.audit': 'Audit',
    'ui.list.title': 'Weekly reports',
    'ui.list.empty': 'No weekly reports for this week',
    'ui.list.hint': 'Select a week, then choose a report below to inspect its reconciliation.',
    'ui.queue.title': 'Reports awaiting review',
    'ui.queue.empty': 'No reports are awaiting review',
    'ui.queue.hint': 'Submitted, under-review and returned reports appear here.',
    'ui.filter.status': 'All statuses',
    'ui.filter.employee': 'All agents',
    'ui.filter.search': 'Search reference, service or client',
    'ui.filter.service': 'All services',
    'ui.filter.paymentStatus': 'All payment statuses',
    'ui.filter.start': 'From',
    'ui.filter.end': 'To',
    'ui.filter.reset': 'Clear filters',
    'ui.label.reportNumber': 'Report number',
    'ui.label.period': 'Period',
    'ui.label.submittedAt': 'Submitted at',
    'ui.label.weekStart': 'Week starting',
    'ui.label.weekEnd': 'Week ending',
    'ui.label.reports': 'reports',
    'ui.label.details': 'Details',
    'ui.label.view': 'View',
    'ui.label.close': 'Close',
    'ui.label.save': 'Save draft',
    'ui.label.saving': 'Saving…',
    'ui.label.cancel': 'Cancel',
    'ui.label.remove': 'Remove',
    'ui.label.download': 'Download evidence',
    'ui.label.noEvidence': 'No evidence uploaded',
    'ui.label.none': '—',
    'ui.label.eligible': 'Eligible',
    'ui.label.notEligible': 'Not eligible',
    'ui.label.date': 'Date',
    'ui.label.transaction': 'Transaction',
    'ui.label.service': 'Service',
    'ui.label.client': 'Client',
    'ui.label.price': 'Customer price',
    'ui.label.cost': 'Official cost',
    'ui.label.paid': 'Payment amount',
    'ui.label.grossProfit': 'Gross profit',
    'ui.label.commission': 'Commission',
    'ui.label.method': 'Payment method',
    'ui.label.export': 'Export',
    'ui.label.actions': 'Actions',
    'ui.label.collections': 'Collections',
    'ui.label.costs': 'Costs',
    'ui.label.expected': 'Expected',
    'ui.label.actual': 'Actual',
    'ui.label.difference': 'Difference',
    'ui.label.category': 'Category',
    'ui.label.description': 'Description',
    'ui.label.paymentSource': 'Payment source',
    'ui.label.receipt': 'Receipt',
    'ui.label.approver': 'Approver',
    'ui.label.expectedCash': 'Expected cash',
    'ui.label.missingNotice': 'A missing closing is not zero: no daily closing was recorded for this day.',
    'ui.label.overrideAuthorized': 'Authorized override',
    'ui.label.overrideBy': 'Authorized by',
    'ui.label.overrideAt': 'Authorized at',
    'ui.label.missingOverride': 'Missing-closing acknowledgement',
    'ui.label.statement': 'Statement of account',
    'ui.label.item': 'No.',
    'ui.label.value': 'Value',
    'ui.label.allocations': 'Outstanding allocation history',
    'ui.label.adjustments': 'Recorded adjustments',
    'ui.label.auditAction': 'Action',
    'ui.label.auditActor': 'Actor',
    'ui.label.auditWhen': 'When',
    'ui.label.auditDetails': 'Details',
    'ui.label.reviewNote': 'Review note',
    'ui.label.correctionReason': 'Correction reason',
    'ui.label.rejectionReason': 'Rejection reason',
    'ui.label.kind': 'Kind',
    'ui.label.label': 'Label',
    'ui.label.reason': 'Reason',
    'ui.label.submissionNote': 'Submission note',
    'ui.label.evidenceHelp': 'PDF, PNG, JPG or WEBP, up to 10 MB.',
    'ui.label.expenseNote': 'Only approved collection-funded expenses in the calculation reduce expected remittance.',
    'ui.label.costPaymentNote': 'Customer payment status never proves that an official cost was funded by the agent. Only a verified payment from her own phone reduces expected remittance.',
    'ui.label.costPaymentSummary': 'Personal cost claims',
    'ui.label.costPaymentRecorded': 'Official cost payment claim recorded.',
    'ui.label.costPaymentRemoved': 'Official cost payment claim removed.',
    'ui.label.selectCostTransaction': 'Select a transaction to declare how its official cost was paid',
    'ui.label.personalPaymentNo': 'No — paid by the company or another source',
    'ui.label.personalPaymentYes': 'Yes — paid from my own funds',
    'ui.label.costVerificationNote': 'Reviewer note',
    'ui.label.partialPayment': 'Partial payment',
    'ui.label.deductibleAmount': 'Deductible amount',
    'ui.label.shortageNote': 'Amounts below come from the backend calculation and are never recalculated here.',
    'ui.label.verifiedTotal': 'Verified submissions drive shortage and surplus.',
    'ui.label.generating': 'Generating…',
    'ui.label.loading': 'Loading…',
    'ui.label.loadingWeeks': 'Loading weeks…',
    'ui.label.records': 'records',
    'ui.label.pageOf': 'Page {page} of {pages}',
    'ui.label.backToQueue': 'Back to queue',
    'ui.label.openWorkspace': 'Open workspace',
    'ui.label.reviewWorkspace': 'Review workspace',
    'ui.label.allWeeks': 'All weeks',
    'ui.label.report': 'Report',
    'ui.label.saved': 'Draft saved.',
    'ui.label.submitted': 'Report submitted.',
    'ui.label.momoAdded': 'Money submission added.',
    'ui.label.momoRemoved': 'Money submission removed.',
    'ui.label.reviewRecorded': 'Review action recorded.',
    'ui.label.adjustmentRecorded': 'Adjustment recorded.',
    'ui.label.overrideRecorded': 'Override authorized.',
    'ui.label.generated': 'Weekly generation complete.',
    'ui.error.required': 'This field is required.',
    'ui.error.referenceRequired': 'A money submission reference is required.',
    'ui.error.referenceShort': 'The reference must be at least 4 characters.',
    'ui.error.amountRequired': 'A positive amount is required.',
    'ui.error.evidenceType': 'Evidence must be a PDF, PNG, JPG or WEBP file.',
    'ui.error.evidenceSize': 'Evidence must be 10 MB or smaller.',
    'ui.error.overrideDisabled': 'Overrides are disabled by policy.',
    'ui.error.exportFailed': 'The export could not be downloaded.',
    'ui.error.loadFailed': 'The report could not be loaded.',
    'ui.error.accessDenied': 'You do not have access to this weekly report.',
  },
  rw: {
    'nav.weeklyReports': "Raporo y'Amafaranga y'Icyumweru",
    'nav.weeklyReview': 'Gusuzuma Raporo y’Icyumweru',
    'page.title': "Raporo y'Amafaranga y'Umukozi wa Serivisi",
    'page.subtitle': 'Kugenzura amafaranga, kohereza amafaranga no gusuzuma imari',
    'switcher.label': 'Ururimi',
    'period.current': 'Icyumweru kiriho',
    'period.previous': 'Icyumweru gishize',
    'period.select': 'Hitamo icyumweru',
    'section.overview': 'Incamake y’imari',
    'section.transactions': 'Ibyakozwe muri icyumweru',
    'section.closings': 'Gufunga kwa buri munsi',
    'section.expenses': 'Amafaranga yemejwe',
    'section.officialCosts': 'Kwishyura amafaranga y’ibikorwa bya serivisi',
    'section.momo': 'Kohereza amafaranga',
    'section.shortage': 'Kugabanuka / Kwiyongera',
    'section.review': 'Gusuzuma imari',
    'section.audit': 'Amateka y’ubugenzuzi',
    'field.agent': 'Umukozi wa serivisi',
    'field.week': 'Icyumweru',
    'field.due': 'Itariki ntarengwa yo kohereza',
    'field.status': 'Imiterere',
    'field.transactionCount': 'Umubare w’ibyakozwe',
    'field.collections': 'Amafaranga yakusanyijwe',
    'field.serviceCosts': 'Amafaranga y’ibikorwa bya serivisi',
    'field.costPaymentStatus': 'Imiterere y’ishyura ry’umukiriya',
    'field.officialCostPaymentStatus': 'Kwemeza ikiguzi cya serivisi',
    'field.personalPayment': 'Yishyuriwe n’umukozi ku mafaranga ye?',
    'field.personalPaidAmount': 'Amafaranga yishyuriwe n’umukozi',
    'field.paymentProvider': 'Uwatanga serivisi yo kwishyura',
    'field.paidAt': 'Itariki n’igihe by’ishyura',
    'field.reviewerDecision': 'Icyemezo cy’usuzuma',
    'field.authorizedReceipts': 'Amafaranga yakiriwe byemewe',
    'field.providerPayments': 'Amafaranga yatanzwe ku batanga serivisi',
    'field.approvedExpenses': 'Amafaranga yemejwe akoreshwa mu kusanya',
    'field.refunds': 'Amafaranga yasubizwemo byemewe',
    'field.otherOutflows': 'Andi mafaranga yasohotse byemewe',
    'field.commissionRetained': 'Komisiyo yagumishijwe',
    'field.expectedRemittance': 'Amafaranga ateganyijwe koherezwa',
    'field.agentReported': 'Amafaranga umukozi yatangaje',
    'field.verifiedSubmitted': 'Amafaranga yoherejwe yemejwe',
    'field.shortage': 'Kugabanuka',
    'field.surplus': 'Kwiyongera',
    'field.commissionEarned': 'Komisiyo yabonye',
    'field.openingOutstanding': 'Amafaranga yari asigaye ku itangira',
    'field.closingOutstanding': 'Amafaranga asigaye ku iherezo',
    'field.reasonCategory': 'Impamvu yo kugabanuka',
    'field.explanation': 'Ibisobanuro birambuye',
    'field.evidence': 'Icyemezo',
    'field.resolutionDate': 'Itariki iteganijwe yo gukemura',
    'field.overrideReason': 'Impamvu y’uburenganzira budasanzwe',
    'field.provider': 'Ubatanga serivisi',
    'field.reference': 'Nomero yerekana',
    'field.amount': 'Amafaranga',
    'field.datetime': 'Itariki n’igihe',
    'field.senderPhone': 'Telefone y’uwohereza',
    'field.recipientPhone': 'Telefone w’uwakiriye',
    'field.confirmation': 'Kodi y’icyemezo',
    'field.notes': 'Inyandiko',
    'field.verification': 'Kwemeza',
    'field.comments': 'Ibitekerezo',
    'field.original': 'Iya mbere',
    'field.adjusted': 'Iyahinduwe',
    'action.generate': 'Kora raporo',
    'action.submit': 'Ohereza raporo',
    'action.resubmit': 'Ohereza nanone',
    'action.addMomo': 'Ongera kohereza',
    'action.addCostPayment': 'Andika ishyura n’umukozi',
    'action.verifyCost': 'Emera ishyura ry’ikiguzi',
    'action.rejectCost': 'Ganena ishyura ry’ikiguzi',
    'action.verify': 'Emera',
    'action.rejectTransfer': 'Ganena kohereza',
    'action.requestCorrection': 'Saba gukosora',
    'action.approve': 'Emera raporo',
    'action.reject': 'Ganena raporo',
    'action.adjust': 'Andika ihinduka',
    'action.downloadPdf': 'Kuramo PDF',
    'action.downloadExcel': 'Kuramo Excel',
    'action.retry': 'Subirira',
    'status.draft': 'Icyegeranyo',
    'status.ready_for_submission': 'Yiteguye koherezwa',
    'status.submitted': 'Yoherejwe',
    'status.under_financial_review': 'Irimo gusuzumwa',
    'status.returned_for_correction': 'Yasubijwe kugira ngo ikosorwe',
    'status.approved': 'Yemejwe',
    'status.rejected': 'Yanenzwe',
    'status.late': 'Yatinze',
    'status.pending': 'Itegereje',
    'status.verified': 'Yemejwe',
    'status.not_claimed': 'Ntiratangajwe',
    'status.not_applicable': 'Ntibikwiye',
    'status.missing': 'Iyabuze',
    'status.paid': 'Yishyuriwe',
    'status.partially_paid': 'Yishyuriwe igice',
    'status.unpaid': 'Ntiyishyuriwe',
    'status.cancelled': 'Yahagaritswe',
    'status.refunded': 'Yasubizwemo',
    'status.reversed': 'Yahinduriwe inzira',
    'status.yes': 'Yego',
    'status.no': 'Oya',
    'status.partial': 'Igice',
    'error.shortage_explanation': 'Ibisobanuro birambuye by’igabanuka birakenewe.',
    'error.shortage_evidence': 'Icyemezo kirakenewe kugira ngo hagaragazwe igabanuka.',
    'error.unexplained_shortage': 'Igabanuka ntirishobora koherezwa nta mpamvu yemewe.',
    'error.duplicate_reference': 'Iyi nomero y’ohereza amafaranga imaze kubaho.',
    'error.invalid_transition': 'Iyi mpinduka y’imiterere ntiyemewe.',
    'error.locked': 'Raporo yoherejwe ifunzwe; saba gukosora.',
    'error.shortage_resolution': 'Itariki iteganijwe yo gukemura igabanuka irakenewe.',
    'error.late_blocked': 'Kohereza nyuma y’igihe bibujijwe na politiki y’ubu.',
    'error.claim_duplicate': 'Iki kiguzi cya serivisi kimaze kugira icyemezo cy’ishyura.',
    'error.claim_invalid_amount': 'Amafaranga yishyuriwe n’umukozi agomba kuba hejuru ya zeru kandi atarenza ikiguzi cya serivisi.',
    'error.claim_reference_required': 'Nomero yerekana ishyura irakenewe.',
    'error.claim_sender_required': 'Telefone yakoreshejwe mu kwishyura ikiguzi irakenewe.',
    'error.claim_evidence_required': 'Icyemezo cy’ishyura n’umukozi kirakenewe.',
    'error.claim_invalid_date': 'Itariki y’ishyura igomba kuba muri icyumweru cya raporo.',
    'error.claim_not_personal': 'Ikiguzi kitishyuriwe n’umukozi ku mafaranga ye ntikishyurwa muri raporo.',
    'error.invalid_week': 'Icyumweru cya raporo kigomba gutangira ku Cyumweru mu gihe cya Kigali.',
    'notification.generated': 'Raporo y’imari ya {period} yateguwe.',
    'notification.due': 'Raporo y’imari ya {period} igomba koherezwa uyu munsi saa {time}.',
    'notification.submitted': 'Raporo y’imari ya {period} yoherejwe na {agent}.',
    'notification.returned': 'Raporo y’imari ya {period} yasubijwe kugira ngo ikosorwe.',
    'notification.approved': 'Raporo y’imari ya {period} yemejwe.',
    'notification.rejected': 'Raporo y’imari ya {period} yanenzwe.',
    'notification.shortage': 'Raporo ya {period} ifite igabanuka rya {amount}.',
    'notification.submitted_ack': 'Raporo yawe y’imari ya {period} yoherejwe.',
    'notification.momo_verified': 'Kohereza {reference} byemejwe nka {status}.',
    'notification.cost_payment_submitted': 'Ishyura n’umukozi {reference} ry’ikiguzi muri {period} ritegereje kwemezwa.',
    'notification.cost_payment_verified': 'Ishyura ry’ikiguzi {reference} ryemejwe nka {status}.',
    'notification.override_requested': 'Uburenganzira budasanzwe bwatanzwe kuri raporo ya {period}.',
    'notification.late': 'Raporo y’imari ya {period} yatinze.',
    'export.title': "Raporo y'Amafaranga y'Umukozi wa Serivisi",
    'export.period': 'Igihe cya raporo',
    'export.generatedAt': 'Yakozwe saa',
    'export.statementItem': 'Ingingo ya raporo',
    'export.value': 'Agaciro',
    'export.verifiedCalculation': 'Kubara kwemejwe',
    'export.component': 'Kintu',
    'export.transaction': 'Ibyakozwe',
    'export.customerPayment': 'Ishyura ry’umukiriya',
    'export.officialCosts': 'Amafaranga y’ibikorwa bya serivisi',
    'export.personalPayment': 'Ishyura n’umukozi',
    'export.deductibleAmount': 'Amafaranga yemejwe agabanya',
    'statement.1': 'Igihe cya raporo n’umwirondoro w’umukozi',
    'statement.2': 'Amafaranga yari asigaye ku itangira',
    'statement.3': 'Umubare w’ibyakozwe byemewe',
    'statement.4': 'Amafaranga yakusanyijwe mu byakozwe byemewe',
    'statement.5': 'Amafaranga y’ibikorwa bya serivisi n’ishyura n’umukozi yemejwe',
    'statement.6': 'Amafaranga yakiriwe muri icyumweru',
    'statement.7': 'Amafaranga yatanzwe ku batanga serivisi yemejwe (ikiguzi n’ihinduka)',
    'statement.8': 'Amafaranga yemejwe akoreshwa mu kusanya',
    'statement.9': 'Amafaranga yasubizwemo byemewe',
    'statement.10': 'Andi mafaranga yasohotse byemewe',
    'statement.11': 'Komisiyo yagumishijwe (iyemewe gusa)',
    'statement.12': 'Amafaranga ateganyijwe koherezwa',
    'statement.13': 'Kohereza kwa MoMo/banki uko umukozi yatangaje',
    'statement.14': 'Amafaranga yoherejwe yemejwe n’usuzuma',
    'statement.15': 'Amafaranga yagabanutse',
    'statement.16': 'Amafaranga yiyongereye',
    'statement.17': 'Impamvu, icyemezo n’itariki yo gukemura igabanuka',
    'statement.18': 'Komisiyo yabonye (20% by’inyungu, yerekanywe ukwabyo)',
    'statement.19': 'Gufunga kwa buri munsi n’uburenganzira bw’ibyabuze',
    'statement.20': 'Amafaranga asigaye n’amateka y’aho yakuweye',
    'statement.21': 'Imiterere, kwemeza, ihinduka n’amateka y’ubugenzuzi',
    // Screen-only keys (the backend does not render these strings).
    'ui.status.pending_payment': 'Itegereje kwishyura',
    'ui.status.completed': 'Byarangiye',
    'ui.status.failed': 'Byanze',
    'ui.status.unverified': 'Ntabwo yemejwe',
    'ui.status.rejected_transfer': 'Kohereza kwanenzwe',
    'ui.reason.cash_count_error': 'Ikosa mu kubara amafaranga',
    'ui.reason.unrecorded_collection': 'Amafaranga yakusanyijwe atanditswe',
    'ui.reason.unapproved_expense': 'Amafaranga yakoreshejwe atemewe',
    'ui.reason.provider_payment_timing': 'Igihe cyo kwishyura abatanga serivisi',
    'ui.reason.bank_delay': 'Ikerereza rya banki',
    'ui.reason.documentation_error': 'Ikosa mu nyandiko',
    'ui.reason.other': 'Ibindi',
    'ui.adjustment.authorized_receipt': 'Amafaranga yakiriwe byemewe',
    'ui.adjustment.provider_payment': 'Amafaranga y’abatanga serivisi',
    'ui.adjustment.collection_expense': 'Amafaranga yo kusanya',
    'ui.adjustment.authorized_refund': 'Amafaranga yasubizwemo',
    'ui.adjustment.other_outflow': 'Andi mafaranga yasohotse',
    'ui.adjustment.commission_retained': 'Komisiyo yagumishijwe',
    'ui.adjustment.outstanding_correction': 'Gukosora amafaranga asigaye',
    'ui.adjustment.outstanding_waiver': 'Kurengera amafaranga asigaye',
    'ui.provider.momo': 'MoMo',
    'ui.provider.bank_transfer': 'Kohereza kwa banki',
    'ui.provider.cash_deposit': 'Kubitsa amafaranga',
    'ui.tab.overview': 'Incamake',
    'ui.tab.transactions': 'Ibyakozwe',
    'ui.tab.closings': 'Gufunga buri munsi',
    'ui.tab.expenses': 'Amafaranga',
    'ui.tab.officialCosts': 'Ibiciro bya serivisi',
    'ui.tab.momo': 'MoMo',
    'ui.tab.shortage': 'Kugabanuka / Kwiyongera',
    'ui.tab.review': 'Gusuzuma',
    'ui.tab.audit': 'Ubugenzuzi',
    'ui.list.title': 'Raporo z’icyumweru',
    'ui.list.empty': 'Nta raporo z’icyumweru ziraho',
    'ui.list.hint': 'Hitamo icyumweru, hanyuma uhitamo raporo hepfo kugira ngo urebe uko amafaranga yagenzuwe.',
    'ui.queue.title': 'Raporo zitegereje gusuzumwa',
    'ui.queue.empty': 'Nta raporo zitegereje gusuzumwa',
    'ui.queue.hint': 'Raporo zoherejwe, zirimo gusuzumwa n’izasubijwe ziri hano.',
    'ui.filter.status': 'Imiterere yose',
    'ui.filter.employee': 'Abakozi bose',
    'ui.filter.search': 'Shakisha nomero, serivisi cyangwa umukiriya',
    'ui.filter.service': 'Serivisi zose',
    'ui.filter.paymentStatus': 'Imiterere y’ishyura yose',
    'ui.filter.start': 'Kuva',
    'ui.filter.end': 'Kugeza',
    'ui.filter.reset': 'Sura ayunguruzo',
    'ui.label.reportNumber': 'Nomero ya raporo',
    'ui.label.period': 'Igihe',
    'ui.label.submittedAt': 'Yoherejwe saa',
    'ui.label.weekStart': 'Icyumweru gutangira',
    'ui.label.weekEnd': 'Icyumweru kurangira',
    'ui.label.reports': 'raporo',
    'ui.label.details': 'Ibisobanuro',
    'ui.label.view': 'Reba',
    'ui.label.close': 'Funga',
    'ui.label.save': 'Bika icyegeranyo',
    'ui.label.saving': 'Kubika…',
    'ui.label.cancel': 'Hagarika',
    'ui.label.remove': 'Kuraho',
    'ui.label.download': 'Kuramo icyemezo',
    'ui.label.noEvidence': 'Nta cyemezo cyashyizweho',
    'ui.label.none': '—',
    'ui.label.eligible': 'Yemewe',
    'ui.label.notEligible': 'Ntiyemewe',
    'ui.label.date': 'Itariki',
    'ui.label.transaction': 'Ibyakozwe',
    'ui.label.service': 'Serivisi',
    'ui.label.client': 'Umukiriya',
    'ui.label.price': 'Amafaranga y’umukiriya',
    'ui.label.cost': 'Amafaranga ya serivisi',
    'ui.label.paid': 'Amafaranga yishyuriwe',
    'ui.label.grossProfit': 'Inyungu mbonezamubano',
    'ui.label.commission': 'Komisiyo',
    'ui.label.method': 'Uburyo bwo kwishyura',
    'ui.label.export': 'Kuramo',
    'ui.label.actions': 'Ibikorwa',
    'ui.label.collections': 'Amafaranga yakusanyijwe',
    'ui.label.costs': 'Amafaranga y’ibikorwa',
    'ui.label.expected': 'Biteganijwe',
    'ui.label.actual': 'Nyabyo',
    'ui.label.difference': 'Itandukaniro',
    'ui.label.category': 'Icyiciro',
    'ui.label.description': 'Ibisobanuro',
    'ui.label.paymentSource': 'Inkomoko y’ishyura',
    'ui.label.receipt': 'Icyemezo',
    'ui.label.approver': 'Uwemeje',
    'ui.label.expectedCash': 'Amafaranga ateganijwe',
    'ui.label.missingNotice': 'Gufunga kwa buri munsi kubuze ntibivuze zeru: nta gufunga kwanditswe kuri iyi munsi.',
    'ui.label.overrideAuthorized': 'Uburenganzira budasanzwe',
    'ui.label.overrideBy': 'Bwemejwe na',
    'ui.label.overrideAt': 'Bwemejwe saa',
    'ui.label.missingOverride': 'Kwemera gufunga kwebuye',
    'ui.label.statement': 'Raporo y’imari',
    'ui.label.item': 'No.',
    'ui.label.value': 'Agaciro',
    'ui.label.allocations': 'Amateka y’amafaranga asigaye',
    'ui.label.adjustments': 'Ihinduka ryanditswe',
    'ui.label.auditAction': 'Igikorwa',
    'ui.label.auditActor': 'Uwagikoze',
    'ui.label.auditWhen': 'Igihe',
    'ui.label.auditDetails': 'Ibisobanuro',
    'ui.label.reviewNote': 'Ibitekerezo by’usuzuma',
    'ui.label.correctionReason': 'Impamvu yo gukosora',
    'ui.label.rejectionReason': 'Impamvu yo kuganena',
    'ui.label.kind': 'Ubwoko',
    'ui.label.label': 'Izina',
    'ui.label.reason': 'Impamvu',
    'ui.label.submissionNote': 'Ibitekerezo ku kohereza',
    'ui.label.evidenceHelp': 'PDF, PNG, JPG cyangwa WEBP, kugeza kuri 10 MB.',
    'ui.label.expenseNote': 'Gusa amafaranga yemejwe akoreshwa mu kusanya ari muri kubara agabanya amafaranga ateganijwe koherezwa.',
    'ui.label.costPaymentNote': 'Ishyura ry’umukiriya ntabwo ryemeza ko ikiguzi cya serivisi cyishyuriwe n’umukozi. Ishyura yemejwe gusa ituruka kuri telefone ye rigabanya amafaranga ateganijwe koherezwa.',
    'ui.label.costPaymentSummary': 'Ibirego by’ishyura n’umukozi',
    'ui.label.costPaymentRecorded': 'Icyemezo cy’ishyura ry’ikiguzi cyanditswe.',
    'ui.label.costPaymentRemoved': 'Icyemezo cy’ishyura ry’ikiguzi gikuweho.',
    'ui.label.selectCostTransaction': 'Hitamo ibyakozwe kugira ngo utangaze uko ikiguzi cya serivisi cyishyuriwe',
    'ui.label.personalPaymentNo': 'Oya — byishyuriwe n’ikigo cyangwa undi',
    'ui.label.personalPaymentYes': 'Yego — byishyuriwe n’amafaranga yanjye',
    'ui.label.costVerificationNote': 'Ibitekerezo by’usuzuma',
    'ui.label.partialPayment': 'Ishyura igice',
    'ui.label.deductibleAmount': 'Amafaranga agabanya',
    'ui.label.shortageNote': 'Amafaranga akurikira yavuye muri kubara k’urubuga rw’imari; ntabwo yongeye kubarwa hano.',
    'ui.label.verifiedTotal': 'Amafaranga yemejwe niyo agena kugabanuka cyangwa kwiyongera.',
    'ui.label.generating': 'Kora…',
    'ui.label.loading': 'Birimo gupakururwa…',
    'ui.label.loadingWeeks': 'Icyumweru kirimo gupakurura…',
    'ui.label.records': 'inyandiko',
    'ui.label.pageOf': 'Urupapuro {page} rwa {pages}',
    'ui.label.backToQueue': 'Subira ku rutonde',
    'ui.label.openWorkspace': 'Fungura aho ukorera',
    'ui.label.reviewWorkspace': 'Aho gusuzuma',
    'ui.label.allWeeks': 'Ibyumweru byose',
    'ui.label.report': 'Raporo',
    'ui.label.saved': 'Icyegeranyo cyabitswe.',
    'ui.label.submitted': 'Raporo yoherejwe.',
    'ui.label.momoAdded': 'Kohereza amafaranga kongerewe.',
    'ui.label.momoRemoved': 'Kohereza amafaranga kuwe.',
    'ui.label.reviewRecorded': 'Igikorwa cy’ubusuzuma cyanditswe.',
    'ui.label.adjustmentRecorded': 'Ihinduka ryanditswe.',
    'ui.label.overrideRecorded': 'Uburenganzira budasanzwe bwemejwe.',
    'ui.label.generated': 'Gukora raporo z’icyumweru birangiye.',
    'ui.error.required': 'Iki gice kirakenewe.',
    'ui.error.referenceRequired': 'Nomero yerekana kohereza amafaranga irakenewe.',
    'ui.error.referenceShort': 'Nomero igomba kugira byibuze inyuguti 4.',
    'ui.error.amountRequired': 'Amafaranga meza arakenewe.',
    'ui.error.evidenceType': 'Icyemezo kigomba kuba PDF, PNG, JPG cyangwa WEBP.',
    'ui.error.evidenceSize': 'Icyemezo kigomba kuba 10 MB cyangwa gito.',
    'ui.error.overrideDisabled': 'Uburenganzira budasanzwe ntibwemewe na politiki.',
    'ui.error.exportFailed': 'Kuramo ntibyakunze.',
    'ui.error.loadFailed': 'Raporo ntishoboye gupakururwa.',
    'ui.error.accessDenied': 'Nta burenganzira ufite kuri iyi raporo y’icyumweru.',
  },
};

export function normalizeWeeklyLang(value?: string | null): WeeklyLang {
  return value?.toLowerCase() === 'rw' ? 'rw' : 'en';
}

/** Same interpolation semantics as backend `t(key, lang, **kwargs)`. */
export function translateWeekly(
  key: string,
  lang: WeeklyLang = 'en',
  vars?: Record<string, string | number>
): string {
  const text = LABELS[normalizeWeeklyLang(lang)]?.[key] ?? LABELS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
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
  'weekly_report_generated', 'weekly_report_due', 'weekly_report_late',
  'weekly_report_submitted', 'weekly_report_submitted_ack',
  'weekly_report_returned', 'weekly_report_approved', 'weekly_report_rejected',
  'weekly_report_shortage', 'weekly_momo_verified', 'weekly_override_requested',
]);

export function isWeeklyNotificationType(type?: string | null): boolean {
  return !!type && WEEKLY_NOTIFICATION_TYPES.has(type);
}

/**
 * Weekly notifications are stored by the backend as `English / Kinyarwanda`.
 * Pick the half matching the current UI language; non-weekly text is never
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
  return () => { langListeners.delete(listener); };
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

/** A visible `[ EN ] [ RW ]` control. Switching never reloads or resets state. */
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
