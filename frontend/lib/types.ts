// ── Generic API envelope ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Machine-readable code — branch on this, not {@link error} text. */
  errorCode?: string;
  meta?: { timestamp: string };
}

/** Spring Data Page shape from paginated list endpoints. */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ── Career score ─────────────────────────────────────────────────────────────
// Field names match Jackson JSON output: boolean isStale → serialized as "stale"
export interface CareerScoreResponse {
  overallScore: number;
  band: string;
  bandRange: string;
  resumeScore: number;
  applicationsScore: number;
  skillsScore: number;
  profileScore: number;
  githubScore: number;
  cgpaComponent: number;
  githubWeightRedistributed: boolean;
  nextAction: string | null;
  stale: boolean;                 // Java: boolean isStale → JSON key is "stale"
  lastComputedAt: string | null;
  readinessNote: string;
}

export interface ComponentBreakdown {
  value: number;
  max: number;
  upside: number;
  reason: string;
  nextAction: string | null;
}

export interface BreakdownResponse {
  overallScore: number;
  band: string;
  githubWeightRedistributed: boolean;
  nextAction: string | null;
  readinessNote: string;
  resume: ComponentBreakdown | null;
  applications: ComponentBreakdown | null;
  skills: ComponentBreakdown | null;
  profile: ComponentBreakdown | null;
  github: ComponentBreakdown | null;
  cgpa: ComponentBreakdown | null;
}

export interface HistoryEntry {
  recordedDate: string; // LocalDate serialised as "YYYY-MM-DD"
  overallScore: number;
  band: string;
}

export interface CohortInsightResponse {
  available: boolean;
  band: string | null;
  cohortSize: number | null;
  /** Percentile rank 0–100 (higher = better vs cohort). */
  percentile: number | null;
  cohortKey: string | null;
}

// ── Resume ────────────────────────────────────────────────────────────────────
// Jackson: Java record boolean isActive → JSON key "active"
export interface ResumeResponse {
  id: string;
  title: string | null;
  version: number | null;
  fileName: string | null;
  targetRole: string | null;
  readinessScore: number | null;
  keywordScore: number | null;
  impactScore: number | null;
  formattingScore: number | null;
  keywordGaps: string[];
  /** JSON-serialised string[] stored as JSONB string; use parseFixes(). */
  aiFixes: string | null;
  /** pending | processing | done | done_basic | failed */
  analysisStatus: string;
  /** ai | rule_based | null while processing */
  analysisSource: string | null;
  active: boolean;           // Java boolean isActive → "active"
  createdAt: string;
  analyzedAt: string | null;
}

export interface ResumeStatusResponse {
  id: string;
  analysisStatus: string;
  analysisSource: string | null;
  message: string;
}

export interface UploadResponse {
  resumeId: string;
  fileName: string;
  analysisStatus: string;
  message: string;
}

/** Safely parse the aiFixes JSON string from the backend. */
export function parseFixes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ── Score band colours (match design-reference Dashboard.dc.html) ─────────────
const BAND_META: Record<
  string,
  { color: string; accent: string; text: string; bg: string; chipBg: string; chipBd: string }
> = {
  'Getting Started': {
    color: 'text-[#F59E0B]',
    accent: '#F59E0B',
    text: '#F59E0B',
    bg: 'bg-[rgba(245,158,11,0.12)]',
    chipBg: 'rgba(245,158,11,0.12)',
    chipBd: 'rgba(245,158,11,0.32)',
  },
  Building: {
    color: 'text-[#34D399]',
    accent: '#10B981',
    text: '#34D399',
    bg: 'bg-[rgba(16,185,129,0.12)]',
    chipBg: 'rgba(16,185,129,0.12)',
    chipBd: 'rgba(16,185,129,0.32)',
  },
  Strong: {
    color: 'text-[#A78BFA]',
    accent: '#7C3AED',
    text: '#A78BFA',
    bg: 'bg-[rgba(124,58,237,0.12)]',
    chipBg: 'rgba(124,58,237,0.12)',
    chipBd: 'rgba(124,58,237,0.32)',
  },
  Ready: {
    color: 'text-[#2DD4BF]',
    accent: '#2DD4BF',
    text: '#2DD4BF',
    bg: 'bg-[rgba(45,212,191,0.12)]',
    chipBg: 'rgba(45,212,191,0.12)',
    chipBd: 'rgba(45,212,191,0.32)',
  },
  'Placement Ready': {
    color: 'text-[#2DD4BF]',
    accent: '#2DD4BF',
    text: '#2DD4BF',
    bg: 'bg-[rgba(45,212,191,0.12)]',
    chipBg: 'rgba(45,212,191,0.12)',
    chipBd: 'rgba(45,212,191,0.32)',
  },
};

export function getBandMeta(band: string) {
  return BAND_META[band] ?? BAND_META['Getting Started'];
}

/** Display label for top band — design uses "Ready"; API may still say "Placement Ready". */
export function bandDisplayName(band: string): string {
  return band === 'Placement Ready' ? 'Ready' : band;
}

// ── Application tracker ───────────────────────────────────────────────────────
export interface TimelineEntryResponse {
  id: string;
  status: string;
  notes: string | null;
  occurredAt: string;
  createdBy: string | null;
}

export interface ApplicationResponse {
  id: string;
  company: string;
  companyCanonical: string;
  role: string;
  roleCanonical: string;
  source: string;
  sourcePlatform: string | null;
  jobUrl: string | null;
  appliedDate: string;
  resumeId: string | null;
  currentStatus: string;
  priority: string;
  recruiterName: string | null;
  recruiterEmail: string | null;
  nextAction: string | null;
  nextActionDue: string | null;
  responseLatencyDays: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntryResponse[] | null;
}

export interface CreateApplicationRequest {
  company: string;
  role: string;
  source?: string;
  appliedDate: string;
  jobUrl?: string;
  resumeId?: string;
  notes?: string;
  priority?: string;
}

export interface CreateApplicationResult {
  application: ApplicationResponse | null;
  possibleDuplicate: boolean;
  existingMatch: ApplicationResponse | null;
}

export interface UpdateApplicationRequest {
  company?: string;
  role?: string;
  appliedDate?: string;
  jobUrl?: string;
  resumeId?: string;
  notes?: string;
  priority?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  nextAction?: string;
  nextActionDue?: string;
}

export interface StatusUpdateRequest {
  status: string;
  notes?: string;
}

export interface OutcomeRequest {
  outcome: 'interview_got' | 'offer_got' | 'rejected_after_interview';
}

export interface InboundDraftResponse {
  id: string;
  parsedCompany: string | null;
  parsedRole: string | null;
  parsedDate: string | null;
  confidence: number | null;
  needsReview: boolean;
  status: string;
  createdAt: string;
}

export interface ConfirmDraftRequest {
  company?: string;
  role?: string;
  appliedDate?: string;
}

export interface ForwardingAddressResponse {
  id: string;
  address: string;
  createdAt: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────
export interface CheckoutResponse {
  razorpayKeyId: string;
  orderId: string | null;
  subscriptionId: string | null;
  amountInr: number;
  currency: string;
  plan: string;
  sandbox: boolean;
  prefillEmail: string;
}

interface UsageMetricResponse {
  metric: string;
  used: number;
  limit: number;
  resetsAt: string;
}

export interface SubscriptionInfoResponse {
  planTier: string;
  status: string;
  seasonPass: boolean;
  amountInr: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  expired: boolean;
  usage: UsageMetricResponse[];
}

interface PricingTier {
  amountInr: number;
  label: string;
  oneTime: boolean;
  months?: number;
  perMonthInr?: number;
}

export interface PricingResponse {
  seasonPass: PricingTier;
  monthly: PricingTier;
  annual: PricingTier;
}

// ── Feedback & Admin ──────────────────────────────────────────────────────────
export interface AdminStatsResponse {
  aiCostToday: number;
  activeUsersToday: number;
  revenueThisMonthInr: number;
  failedJobs: number;
  systemStatus: string;
}

export interface AdminFeedbackItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  message: string;
  screen: string | null;
  type: string;
  createdAt: string;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}
