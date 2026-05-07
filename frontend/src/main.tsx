import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Gauge,
  History,
  LayoutTemplate,
  Library,
  ListChecks,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Unlock,
  Upload,
  Wand2,
} from "lucide-react";
import "./styles.css";

type Severity = "good" | "warning" | "bad";

type Issue = {
  title: string;
  detail: string;
  severity: Severity;
};

type ScoreCard = {
  label: string;
  score: number;
  detail: string;
};

type QualityGate = {
  label: string;
  score: number;
  target: number;
  passed: boolean;
  detail: string;
};

type AtsCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  missing?: string[];
};

type AtsResult = {
  passed: boolean;
  checks: AtsCheck[];
  anchors: string[];
  matchedAnchors: string[];
  missingAnchors: string[];
  anchorCoverageScore: number;
  dateFormats: string[];
  resumeHeaderRole: string;
  jdRoleTitle: string;
};

type HumanSubscores = {
  coherence: number;
  specificity: number;
  antiStuffing: number;
  evidence: number;
  metrics: number;
  orphans: number;
};

type HumanResult = {
  score: number;
  band: "risk" | "acceptable" | "strong";
  subscores: HumanSubscores;
  diagnostics: string[];
};

type TargetingSignal = {
  label: string;
  category: "Tools" | "Responsibilities" | "Automation" | "Documentation" | "Compliance" | "Training" | "Cloud" | "Ownership";
  status: "strong" | "partial" | "missing";
  evidence: string;
  terms: string[];
};

type ProofPillar = {
  label: string;
  score: number;
  status: "strong" | "partial" | "missing";
  jdNeed: string;
  resumeProof: string;
  terms: string[];
};

type RoleBlueprint = {
  targetRole: string;
  roleThesis: string;
  proofPillars: ProofPillar[];
  atsFocus: string[];
  rewriteStrategy: string[];
  humanWarnings: string[];
};

type RoleEvidence = {
  id: string;
  employer: string;
  title: string;
  dates: string;
  section: string;
  startLine: number;
  endLine: number;
  allowedTools: string[];
  allowedMetrics: string[];
  allowedActions: string[];
  allowedObjects: string[];
  allowedOutcomes: string[];
  scopeEvidence: string[];
};

type EvidenceGraph = {
  employers: string[];
  dates: string[];
  degrees: string[];
  certifications: string[];
  toolsMentioned: string[];
  frameworks: string[];
  metrics: string[];
  actionsTaken: string[];
  scope: string[];
  roles: RoleEvidence[];
  sectionTools: Record<string, string[]>;
};

type DomainProfile = {
  id: string;
  name: string;
  signals: string[];
  coreTerms: string[];
  roles: string[];
  categories: string[];
  systems: string[];
  outcomes: string[];
};

type BulletReview = {
  text: string;
  score: number;
  verdict: string;
  fixes: string[];
  rewrite: string;
};

type Analysis = {
  overall: number;
  projected: number;
  ats: AtsResult;
  human: HumanResult;
  domain: DomainProfile;
  roleBlueprint: RoleBlueprint;
  evidenceGraph: EvidenceGraph;
  cards: ScoreCard[];
  gates: QualityGate[];
  targetingSignals: TargetingSignal[];
  issues: Issue[];
  proChecks: ScoreCard[];
  bulletReviews: BulletReview[];
  matchedKeywords: string[];
  missingKeywords: string[];
  repeatedVerbs: Array<[string, number]>;
  quantified: { quantified: number; total: number };
  hygiene: { orphanFragments: string[]; metricLeadCount: number; metricLeadTotal: number };
  bullets: string[];
};

type SavedScan = {
  id: string;
  createdAt: string;
  score: number;
  projected: number;
  title: string;
  resumeText: string;
  jdText: string;
};

type ActiveSession = {
  version: 1;
  updatedAt: string;
  resumeText: string;
  jdText: string;
  fileName: string | null;
  sourceFileName: string | null;
  sourceSessionId: string | null;
  sourceFormatText: string | null;
  sourcePdfBase64: string | null;
  backendWorkflowReport: BackendWorkflowReport | null;
  scanResult: ScanResult | null;
  aiMagicBullets: MagicBullet[] | null;
  aiTailorChanges: string[];
  aiTailorResult: { before: number; after: number } | null;
  finalFileStatus: FinalFileStatus | null;
  downloadFileName: string;
};

type ActiveSessionMetadata = {
  version: 2;
  session_id: string;
  filename: string | null;
  source_filename: string | null;
  jd_hash: string;
  score_snapshot: {
    ats_pass: boolean;
    human_readability: number;
    jd_fit: string;
    overall: number;
  } | null;
  rewrite_state: {
    has_scan: boolean;
    has_ai_tailor: boolean;
    final_status: FinalFileStatus | null;
    download_filename: string;
  };
  last_modified: string;
};

type StoredSessionData = {
  id: string;
  session_id: string;
  source_pdf_blob?: Blob | null;
  original_text: string | null;
  rewritten_text: string;
  evidence_graph: Partial<EvidenceGraph> | null;
  jd_text: string;
  jd_anchors: string[];
  backend_workflow_report: BackendWorkflowReport | null;
  scan_result: ScanResult | null;
  ai_tailor_changes: string[];
  ai_tailor_result: { before: number; after: number } | null;
  updated_at: string;
};

type ScanResult = {
  createdAt: string;
  resumeText: string;
  jdText: string;
  analysis: Analysis;
};

type TailoredDraft = {
  text: string;
  score: number;
  previousScore: number;
  changes: string[];
};

type MagicBullet = {
  label: string;
  bullet: string;
  keywords: string[];
  rationale?: string;
};

type FinalFileStatus = {
  type: "saved" | "blocked" | "skipped";
  message: string;
  fileName?: string;
};

type FitAnalysisEntry = {
  jd_requirement: string;
  evidence_status: "STRONG_MATCH" | "PARTIAL_MATCH" | "WEAK_MATCH" | "MISSING";
  best_matching_bullet_id: string | null;
  current_bullet_text: string | null;
  match_quality: string;
  rewrite_needed: boolean;
  rewrite_suggestion: string | null;
  anchor_terms_to_surface: string[];
  honest_note: string | null;
};

type ScanAnalysis = {
  ats_assessment: {
    passed: boolean;
    score: number;
    checks: { name: string; passed: boolean; note: string }[];
    rationale: string;
  };
  human_readability: {
    score: number;
    band: "risk" | "acceptable" | "strong";
    subscores: {
      orphans: number;
      coherence: number;
      metrics: number;
      specificity: number;
      anti_stuffing: number;
      evidence: number;
    };
    diagnostics: string[];
  };
  jd_summary: {
    role_title: string;
    company: string;
    seniority: string;
    primary_stack: string;
    deal_breakers: string[];
    critical_requirements: string[];
    nice_to_haves: string[];
  };
  fit_analysis: FitAnalysisEntry[];
  overall: {
    fit_score: string;
    recommendation: "STRONG_FIT" | "MODERATE_FIT" | "STRETCH" | "POOR_FIT";
    recommendation_reasoning: string;
    deal_breaker_check: string;
    rewrites_recommended: number;
    rewrites_unnecessary: number;
    honest_gaps: string[];
  };
};

type ScanResponse = {
  result: ScanAnalysis;
  duration_ms: number;
};

type RewriteResultEntry = {
  section: string;
  jd_requirement: string;
  original: string;
  rewrite: string;
  success: boolean;
  reasoning: string | null;
  attempts: number;
};

type RewriteResumeResponse = {
  success: boolean;
  no_changes_needed: boolean;
  prompt: string | null;
  rewrites: RewriteResultEntry[];
  stats: {
    total: number;
    rewritten: number;
    failed: number;
    no_change: number;
  };
  duration_ms: number;
  message?: string;
};

type BackendWorkflowReport = {
  status?: string;
  sessionId?: string | null;
  ats_pass?: boolean;
  ats_checks?: AtsCheck[];
  human_score?: number;
  human_subscores?: Record<string, number>;
  anchors?: string[];
  gap_analysis?: Record<string, { status: "covered" | "partial" | "missing"; evidence?: string }>;
  fit_score?: string;
  diagnostic_messages?: string[];
  evidence_graph?: Partial<EvidenceGraph>;
};

type PdfUploadResponse = {
  status?: "stored";
  storage?: "server_temp";
  sessionId?: string;
  fileName?: string;
  text?: string;
  warnings?: string[];
  evidenceGraph?: Partial<EvidenceGraph>;
};

type PatchResponse = {
  status?: "patched" | "no_changes" | "partial" | "error";
  fileName?: string;
  pdfBase64?: string;
  linesChanged?: number;
  replacements?: number;
  reason?: string;
  warnings?: string[];
  failed?: string[];
  error_code?: string;
  message?: string;
  recoverable?: boolean;
  error?: string;
};

type SampleBullet = {
  role: string;
  category: string;
  bullet: string;
  tags: string[];
};

type TemplateOption = {
  name: string;
  fit: string;
  strengths: string[];
};

const DEFAULT_RESUME = `Alex Chen
Security Engineer | Product, Cloud, AppSec & Automation

SUMMARY
Security Engineer with 2+ years of hands-on experience in product security, cloud security, application security, identity, detection, and automation across AWS, EKS, SaaS, endpoint, and Datadog-style telemetry.

PROFESSIONAL EXPERIENCE
Security Engineer, Northwind Technologies | Remote
Jun 2024 - Present
Architected security-engineering workflows across 5 control areas: authentication, authorization, cloud telemetry, logging, and vulnerability paths.
Engineered Python and SPL pipelines across 5 telemetry sources: AWS CloudTrail, Okta, Active Directory, endpoint, and network telemetry.
Developed cloud and identity detections across 7 abuse patterns, improving accuracy by 20%.

PROJECTS
CloudSec Security Engineering Lab - End-to-End AWS/EKS/Datadog Build
Delivered a complete lab-scale security pipeline across 6 signal domains: AWS CloudTrail, EKS workload identity, Secrets Manager/KMS, S3, Okta, and MongoDB telemetry.
`;

const DEFAULT_JD = `Security Engineer, Access Risk Intelligence and Security Mitigation
Preferred: access risk, cloud identity, IAM, RBAC, least privilege, zero-trust access, product security, threat modeling, secure design reviews, AWS, Kubernetes, EKS, CloudTrail, Okta, Google Workspace, Python, dashboards, risk scoring, validation harnesses, anomaly prioritization.`;

const REWRITE_TARGET_SCORE = 90;
const ATS_GATE_SCORE = 100;
const HUMAN_GATE_SCORE = 85;
const EVIDENCE_GATE_SCORE = 75;
const ROLE_FIT_GATE_SCORE = 80;
const MAX_REWRITE_PASSES = 2;


const stopWords = new Set([
  "a",
  "an",
  "and",
  "ability",
  "able",
  "according",
  "are",
  "as",
  "at",
  "background",
  "bachelor",
  "be",
  "business",
  "by",
  "candidate",
  "company",
  "demonstrated",
  "department",
  "description",
  "degree",
  "engineer",
  "engineering",
  "experience",
  "for",
  "from",
  "have",
  "impact",
  "including",
  "in",
  "include",
  "includes",
  "into",
  "is",
  "it",
  "job",
  "make",
  "mercor",
  "medium",
  "minimum",
  "must",
  "new",
  "of",
  "on",
  "or",
  "our",
  "plus",
  "position",
  "power",
  "preferred",
  "professional",
  "procedures",
  "qualification",
  "qualifications",
  "required",
  "requirement",
  "requirements",
  "role",
  "should",
  "skill",
  "skills",
  "science",
  "strong",
  "support",
  "supports",
  "such",
  "that",
  "the",
  "their",
  "this",
  "to",
  "unit",
  "using",
  "well",
  "will",
  "within",
  "with",
  "work",
  "years",
  "you",
  "your",
]);

const actionVerbs = [
  "architected",
  "automated",
  "authored",
  "analyzed",
  "administered",
  "assembled",
  "assessed",
  "audited",
  "calibrated",
  "coached",
  "conducted",
  "configured",
  "coordinated",
  "built",
  "converted",
  "created",
  "delivered",
  "designed",
  "developed",
  "diagnosed",
  "documented",
  "engineered",
  "executed",
  "facilitated",
  "forecasted",
  "hardened",
  "improved",
  "implemented",
  "inspected",
  "installed",
  "instructed",
  "led",
  "launched",
  "maintained",
  "mapped",
  "modeled",
  "managed",
  "measured",
  "monitored",
  "optimized",
  "operationalized",
  "planned",
  "performed",
  "prepared",
  "processed",
  "produced",
  "reconciled",
  "reduced",
  "repaired",
  "reported",
  "researched",
  "resolved",
  "reviewed",
  "shipped",
  "standardized",
  "strengthened",
  "supported",
  "taught",
  "tested",
  "trained",
  "tuned",
  "validated",
];

const genericAtsTerms = [
  "analysis",
  "automation",
  "collaboration",
  "cross-functional",
  "dashboard",
  "documentation",
  "implementation",
  "metrics",
  "optimization",
  "process improvement",
  "project management",
  "quality",
  "reporting",
  "requirements",
  "stakeholder",
  "strategy",
  "testing",
  "validation",
  "workflow",
];

const domainProfiles: DomainProfile[] = [
  {
    id: "security",
    name: "Cybersecurity / Cloud Security",
    signals: ["security", "cloudtrail", "iam", "rbac", "okta", "threat modeling", "vulnerability", "splunk", "soc", "appsec", "devsecops"],
    coreTerms: [
      "aws",
      "cloudtrail",
      "eks",
      "github actions",
      "iam",
      "kubernetes",
      "least privilege",
      "okta",
      "python",
      "rbac",
      "risk scoring",
      "secure sdlc",
      "threat modeling",
      "validation",
      "zero-trust",
    ],
    roles: ["Security Engineer", "Cloud Security Engineer", "Product Security Engineer", "Security Automation Engineer"],
    categories: ["Cloud Security", "Product Security", "Identity", "Automation"],
    systems: ["AWS IAM, Kubernetes, identity telemetry, CI checks, and risk dashboards"],
    outcomes: ["reduce manual triage", "strengthen remediation evidence", "improve detection accuracy"],
  },
  {
    id: "software",
    name: "Software Engineering",
    signals: ["software engineer", "backend", "frontend", "full stack", "react", "node", "java", "api", "microservices", "distributed systems"],
    coreTerms: [
      "api",
      "backend",
      "ci/cd",
      "database",
      "distributed systems",
      "frontend",
      "git",
      "java",
      "javascript",
      "microservices",
      "node.js",
      "react",
      "rest",
      "scalability",
      "typescript",
      "unit testing",
    ],
    roles: ["Software Engineer", "Backend Engineer", "Frontend Engineer", "Full-Stack Engineer"],
    categories: ["Backend", "Frontend", "Platform", "Quality"],
    systems: ["APIs, services, data models, CI/CD, observability, and test suites"],
    outcomes: ["improve reliability", "reduce latency", "increase release velocity"],
  },
  {
    id: "data_ai",
    name: "Data / AI / Analytics",
    signals: ["data analyst", "data scientist", "machine learning", "analytics", "sql", "python", "tableau", "power bi", "etl", "llm"],
    coreTerms: [
      "ab testing",
      "analytics",
      "dashboard",
      "data modeling",
      "etl",
      "experimentation",
      "machine learning",
      "power bi",
      "python",
      "sql",
      "statistics",
      "tableau",
      "visualization",
      "warehouse",
    ],
    roles: ["Data Analyst", "Data Scientist", "Machine Learning Engineer", "Analytics Engineer"],
    categories: ["Analytics", "Machine Learning", "Data Engineering", "Insights"],
    systems: ["SQL models, pipelines, dashboards, experiments, and quality checks"],
    outcomes: ["improve decision speed", "increase forecast accuracy", "reduce reporting effort"],
  },
  {
    id: "electrical",
    name: "Electrical / Electronics Engineering",
    signals: ["electrical engineer", "electronics", "pcb", "schematic", "circuit", "matlab", "simulink", "spice", "power systems", "embedded"],
    coreTerms: [
      "analog",
      "circuit design",
      "control systems",
      "debugging",
      "embedded systems",
      "firmware",
      "hardware validation",
      "matlab",
      "oscilloscope",
      "pcb",
      "power electronics",
      "schematic capture",
      "signal integrity",
      "simulink",
      "spice",
      "test equipment",
    ],
    roles: ["Electrical Engineer", "Electronics Engineer", "Hardware Engineer", "Embedded Systems Engineer"],
    categories: ["Circuit Design", "Hardware Validation", "Embedded", "Power Systems"],
    systems: ["schematics, PCB layouts, test benches, firmware interfaces, and lab equipment"],
    outcomes: ["improve signal quality", "reduce prototype defects", "accelerate validation cycles"],
  },
  {
    id: "mechanical",
    name: "Mechanical / Manufacturing Engineering",
    signals: ["mechanical engineer", "solidworks", "cad", "gd&t", "manufacturing", "thermal", "fea", "root cause", "prototype"],
    coreTerms: [
      "cad",
      "continuous improvement",
      "cross-functional",
      "design engineering",
      "design validation",
      "dfm",
      "fea",
      "gd&t",
      "hands-on troubleshooting",
      "manufacturing",
      "mechanical design",
      "model-based design",
      "process improvement",
      "product design",
      "product engineering",
      "product lifecycle",
      "prototype",
      "quality control",
      "root cause",
      "root cause analysis",
      "solidworks",
      "technical documentation",
      "test procedures",
      "thermal analysis",
      "tolerance analysis",
      "validation",
    ],
    roles: ["Mechanical Engineer", "Manufacturing Engineer", "Design Engineer", "Quality Engineer"],
    categories: ["Design", "Manufacturing", "Quality", "Validation"],
    systems: ["CAD models, prototypes, test fixtures, manufacturing processes, and quality data"],
    outcomes: ["reduce defects", "improve manufacturability", "shorten prototype cycles"],
  },
  {
    id: "civil",
    name: "Civil / Construction Engineering",
    signals: ["civil engineer", "construction", "autocad", "revit", "stormwater", "structural", "site design", "transportation"],
    coreTerms: [
      "autocad",
      "construction management",
      "cost estimate",
      "drainage",
      "permitting",
      "project coordination",
      "revit",
      "site design",
      "stormwater",
      "structural analysis",
      "survey",
      "transportation",
    ],
    roles: ["Civil Engineer", "Structural Engineer", "Project Engineer", "Construction Engineer"],
    categories: ["Design", "Construction", "Permitting", "Project Delivery"],
    systems: ["drawings, site plans, estimates, permit packages, and construction schedules"],
    outcomes: ["reduce rework", "improve delivery timelines", "strengthen compliance"],
  },
  {
    id: "finance",
    name: "Finance / Accounting",
    signals: ["financial analyst", "accountant", "audit", "forecasting", "variance", "excel", "budget", "gaap", "reconciliation"],
    coreTerms: [
      "account reconciliation",
      "audit",
      "budgeting",
      "excel",
      "financial modeling",
      "forecasting",
      "gaap",
      "month-end close",
      "power bi",
      "reporting",
      "sap",
      "variance analysis",
    ],
    roles: ["Financial Analyst", "Accountant", "FP&A Analyst", "Audit Associate"],
    categories: ["Analysis", "Accounting", "Audit", "Reporting"],
    systems: ["financial models, reconciliations, forecasts, controls, and reporting dashboards"],
    outcomes: ["improve forecast accuracy", "shorten close cycles", "reduce reporting variance"],
  },
  {
    id: "marketing_sales",
    name: "Marketing / Sales / Growth",
    signals: ["marketing", "sales", "campaign", "seo", "crm", "pipeline", "lead generation", "conversion", "brand"],
    coreTerms: [
      "a/b testing",
      "brand strategy",
      "campaign",
      "conversion rate",
      "crm",
      "customer segmentation",
      "email marketing",
      "lead generation",
      "pipeline",
      "salesforce",
      "seo",
      "social media",
    ],
    roles: ["Marketing Specialist", "Growth Marketer", "Sales Development Representative", "Account Executive"],
    categories: ["Campaigns", "Growth", "Sales", "CRM"],
    systems: ["campaigns, CRM pipelines, audience segments, content workflows, and conversion dashboards"],
    outcomes: ["increase qualified leads", "improve conversion", "grow pipeline value"],
  },
  {
    id: "product_ops",
    name: "Product / Project / Operations",
    signals: ["product manager", "project manager", "operations", "roadmap", "agile", "scrum", "process improvement", "stakeholder"],
    coreTerms: [
      "agile",
      "backlog",
      "business requirements",
      "jira",
      "kpi",
      "operational efficiency",
      "process improvement",
      "project plan",
      "roadmap",
      "scrum",
      "stakeholder management",
      "user stories",
    ],
    roles: ["Product Manager", "Project Manager", "Operations Analyst", "Program Coordinator"],
    categories: ["Product", "Project Delivery", "Operations", "Stakeholders"],
    systems: ["roadmaps, backlogs, operating metrics, process maps, and stakeholder workflows"],
    outcomes: ["improve delivery predictability", "reduce cycle time", "increase operational clarity"],
  },
  {
    id: "healthcare",
    name: "Healthcare / Clinical",
    signals: ["nurse", "clinical", "patient", "healthcare", "emr", "hipaa", "care plan", "medical assistant"],
    coreTerms: [
      "care coordination",
      "clinical documentation",
      "emr",
      "epic",
      "hipaa",
      "patient care",
      "patient education",
      "quality improvement",
      "safety",
      "triage",
      "vital signs",
    ],
    roles: ["Registered Nurse", "Medical Assistant", "Clinical Coordinator", "Healthcare Administrator"],
    categories: ["Patient Care", "Clinical Operations", "Documentation", "Quality"],
    systems: ["care plans, EMR workflows, patient education, safety checks, and quality metrics"],
    outcomes: ["improve patient experience", "reduce documentation gaps", "strengthen care coordination"],
  },
  {
    id: "design",
    name: "Design / UX / Creative",
    signals: ["ux", "ui", "designer", "figma", "prototype", "user research", "wireframe", "visual design", "portfolio"],
    coreTerms: [
      "accessibility",
      "design system",
      "figma",
      "interaction design",
      "prototype",
      "usability testing",
      "user journey",
      "user research",
      "visual design",
      "wireframes",
    ],
    roles: ["UX Designer", "Product Designer", "UI Designer", "Visual Designer"],
    categories: ["UX", "Product Design", "Research", "Systems"],
    systems: ["research insights, wireframes, prototypes, design systems, and usability tests"],
    outcomes: ["improve task completion", "reduce design rework", "increase user clarity"],
  },
  {
    id: "education",
    name: "Education / Training",
    signals: ["teacher", "instructor", "curriculum", "lesson", "student", "classroom", "learning", "training"],
    coreTerms: [
      "assessment",
      "classroom management",
      "curriculum",
      "differentiated instruction",
      "instructional design",
      "lesson planning",
      "learning outcomes",
      "student engagement",
      "training delivery",
    ],
    roles: ["Teacher", "Instructor", "Training Specialist", "Instructional Designer"],
    categories: ["Instruction", "Curriculum", "Assessment", "Training"],
    systems: ["lesson plans, assessments, training materials, learning platforms, and student data"],
    outcomes: ["improve learner outcomes", "increase engagement", "standardize instruction"],
  },
  {
    id: "legal_hr",
    name: "Legal / HR / Administration",
    signals: ["legal", "paralegal", "contract", "compliance", "human resources", "recruiting", "onboarding", "employee relations"],
    coreTerms: [
      "case management",
      "compliance",
      "contract review",
      "employee relations",
      "hris",
      "legal research",
      "onboarding",
      "policy",
      "recruiting",
      "records management",
      "risk management",
    ],
    roles: ["Paralegal", "HR Generalist", "Recruiter", "Administrative Coordinator"],
    categories: ["Compliance", "People Operations", "Contracts", "Administration"],
    systems: ["case files, HRIS workflows, contracts, policies, and records management"],
    outcomes: ["reduce processing time", "improve compliance", "strengthen stakeholder experience"],
  },
  {
    id: "life_science",
    name: "Life Sciences / Research",
    signals: ["biotech", "biology", "chemistry", "laboratory", "research associate", "assay", "pcr", "hplc", "clinical trial", "gmp"],
    coreTerms: [
      "assay development",
      "cell culture",
      "clinical trials",
      "data analysis",
      "experimental design",
      "gmp",
      "glp",
      "hplc",
      "laboratory safety",
      "pcr",
      "protocols",
      "quality control",
      "research documentation",
      "sample preparation",
      "statistical analysis",
    ],
    roles: ["Research Associate", "Laboratory Technician", "Clinical Research Coordinator", "Quality Control Analyst"],
    categories: ["Research", "Laboratory", "Quality", "Documentation"],
    systems: ["protocols, assays, lab instruments, samples, quality records, and analysis workflows"],
    outcomes: ["improve reproducibility", "reduce sample errors", "strengthen study documentation"],
  },
  {
    id: "supply_chain",
    name: "Supply Chain / Logistics",
    signals: ["supply chain", "logistics", "procurement", "inventory", "warehouse", "erp", "demand planning", "transportation", "vendor"],
    coreTerms: [
      "demand planning",
      "erp",
      "forecasting",
      "inventory control",
      "kpi",
      "logistics",
      "order fulfillment",
      "procurement",
      "route optimization",
      "supplier management",
      "transportation",
      "vendor management",
      "warehouse operations",
    ],
    roles: ["Supply Chain Analyst", "Logistics Coordinator", "Procurement Specialist", "Inventory Analyst"],
    categories: ["Planning", "Logistics", "Procurement", "Operations"],
    systems: ["ERP workflows, inventory data, supplier handoffs, fulfillment processes, and logistics dashboards"],
    outcomes: ["reduce stockouts", "improve fulfillment speed", "lower operating cost"],
  },
  {
    id: "customer_success",
    name: "Customer Support / Success",
    signals: ["customer support", "customer success", "call center", "ticket", "zendesk", "sla", "escalation", "retention", "churn"],
    coreTerms: [
      "account management",
      "case resolution",
      "crm",
      "customer retention",
      "customer satisfaction",
      "escalation management",
      "knowledge base",
      "onboarding",
      "renewals",
      "sla",
      "support tickets",
      "zendesk",
    ],
    roles: ["Customer Support Specialist", "Customer Success Manager", "Technical Support Analyst", "Account Coordinator"],
    categories: ["Support", "Success", "Retention", "Operations"],
    systems: ["support queues, CRM records, escalation paths, onboarding workflows, and customer health metrics"],
    outcomes: ["improve resolution speed", "increase retention", "raise customer satisfaction"],
  },
  {
    id: "retail_hospitality",
    name: "Retail / Hospitality / Food Service",
    signals: ["retail", "hospitality", "restaurant", "guest", "pos", "merchandising", "food safety", "inventory", "front desk"],
    coreTerms: [
      "cash handling",
      "customer service",
      "food safety",
      "guest experience",
      "inventory management",
      "merchandising",
      "pos",
      "sales targets",
      "scheduling",
      "service recovery",
      "store operations",
      "team training",
    ],
    roles: ["Retail Associate", "Restaurant Supervisor", "Hospitality Coordinator", "Store Manager"],
    categories: ["Service", "Operations", "Sales", "Training"],
    systems: ["POS systems, service workflows, inventory checks, scheduling routines, and guest feedback"],
    outcomes: ["increase service quality", "reduce shrink", "improve sales conversion"],
  },
  {
    id: "architecture_real_estate",
    name: "Architecture / Real Estate",
    signals: ["architecture", "architectural", "bim", "revit", "construction documents", "zoning", "real estate", "property", "leasing"],
    coreTerms: [
      "autocad",
      "bim",
      "building codes",
      "construction documents",
      "design development",
      "due diligence",
      "leasing",
      "property management",
      "revit",
      "site analysis",
      "space planning",
      "zoning",
    ],
    roles: ["Architectural Designer", "BIM Coordinator", "Real Estate Analyst", "Property Manager"],
    categories: ["Design", "Documentation", "Property", "Compliance"],
    systems: ["BIM models, drawings, property records, zoning reviews, and stakeholder approvals"],
    outcomes: ["reduce documentation rework", "improve approval readiness", "strengthen portfolio decisions"],
  },
  {
    id: "public_policy",
    name: "Public Policy / Nonprofit",
    signals: ["policy", "nonprofit", "program coordinator", "grant", "community", "public sector", "advocacy", "monitoring and evaluation"],
    coreTerms: [
      "advocacy",
      "community engagement",
      "grant writing",
      "impact reporting",
      "monitoring and evaluation",
      "partnerships",
      "policy analysis",
      "program coordination",
      "public sector",
      "research",
      "stakeholder engagement",
    ],
    roles: ["Policy Analyst", "Program Coordinator", "Grant Specialist", "Nonprofit Operations Associate"],
    categories: ["Policy", "Programs", "Partnerships", "Evaluation"],
    systems: ["program plans, research briefs, grants, stakeholder records, and impact reports"],
    outcomes: ["improve program evidence", "increase funding readiness", "strengthen community outcomes"],
  },
  {
    id: "media_communications",
    name: "Media / Communications / Content",
    signals: ["communications", "content", "copywriting", "editorial", "localization", "public relations", "press release", "journalism", "social media", "translation"],
    coreTerms: [
      "analytics",
      "brand voice",
      "cat tools",
      "content calendar",
      "copywriting",
      "editorial planning",
      "linguistic qa",
      "localization",
      "media relations",
      "press releases",
      "public relations",
      "seo",
      "social media",
      "storytelling",
      "style guides",
      "terminology management",
      "translation memory",
      "writing",
    ],
    roles: ["Content Specialist", "Communications Coordinator", "Copywriter", "Public Relations Associate"],
    categories: ["Content", "Communications", "Brand", "Analytics"],
    systems: ["content calendars, editorial workflows, CAT tools, terminology databases, style guides, and localization QA"],
    outcomes: ["increase audience engagement", "improve language quality", "accelerate content delivery"],
  },
  {
    id: "trades_field_service",
    name: "Trades / Field Service",
    signals: ["technician", "maintenance", "hvac", "electrical", "plumbing", "repair", "installation", "field service", "osha"],
    coreTerms: [
      "diagnostics",
      "equipment maintenance",
      "field service",
      "installation",
      "osha",
      "preventive maintenance",
      "quality inspection",
      "repair",
      "safety compliance",
      "service documentation",
      "troubleshooting",
      "work orders",
    ],
    roles: ["Field Service Technician", "Maintenance Technician", "HVAC Technician", "Installation Specialist"],
    categories: ["Diagnostics", "Maintenance", "Safety", "Service"],
    systems: ["work orders, diagnostic tools, equipment records, safety checks, and customer handoffs"],
    outcomes: ["reduce downtime", "increase first-time fix rate", "improve service documentation"],
  },
  {
    id: "general",
    name: "General Professional",
    signals: [],
    coreTerms: genericAtsTerms,
    roles: ["Professional", "Associate", "Coordinator", "Specialist"],
    categories: ["Operations", "Analysis", "Projects", "Service"],
    systems: ["workflows, documentation, reports, quality checks, and stakeholder handoffs"],
    outcomes: ["improve efficiency", "reduce errors", "strengthen delivery quality"],
  },
];

const atsTerms = genericAtsTerms;

const weakPhrases = [
  "responsible for",
  "worked on",
  "helped with",
  "assisted with",
  "participated in",
  "familiar with",
  "knowledge of",
];

const buzzwords = [
  "hardworking",
  "team player",
  "detail-oriented",
  "go-getter",
  "dynamic",
  "self starter",
  "results-driven",
  "passionate",
  "synergy",
  "leverage",
];

const knownToolTerms = [
  "aws",
  "azure",
  "gcp",
  "sql",
  "python",
  "jupyter",
  "kibana",
  "soc 2",
  "iso 27001",
  "gdpr",
  "hipaa",
  "pci-dss",
  "stellar",
  "stellar cyber",
  "datadog",
  "splunk",
  "tableau",
  "power bi",
  "github actions",
  "lambda",
  "okta",
  "kubernetes",
  "eks",
  "docker",
  "terraform",
  "mongo",
  "mongodb",
  "excel",
  "salesforce",
  "jira",
  "servicenow",
  "autocad",
];

const atsAnchorToolTerms = unique([
  ...knownToolTerms,
  "active directory",
  "airtable",
  "asana",
  "azure ad",
  "bigquery",
  "c++",
  "c#",
  "chef",
  "confluence",
  "crowdstrike",
  "defender",
  "dlp",
  "edr",
  "elastic",
  "figma",
  "firewall",
  "flask",
  "git",
  "gitlab",
  "google workspace",
  "guardduty",
  "hadoop",
  "intune",
  "java",
  "javascript",
  "jenkins",
  "kafka",
  "kusto",
  "looker",
  "matlab",
  "mes",
  "metasploit",
  "microsoft defender",
  "mitre attack",
  "nessus",
  "nist",
  "node.js",
  "numpy",
  "owasp",
  "pandas",
  "powerpoint",
  "prowler",
  "puppet",
  "pytorch",
  "react",
  "revit",
  "s3",
  "sap",
  "scikit-learn",
  "sentinel",
  "siem",
  "snowflake",
  "solidworks",
  "spark",
  "stata",
  "swift",
  "tensorflow",
  "typescript",
  "vanta",
  "waf",
  "wireshark",
  "wiz",
  "word",
  "zendesk",
]);

const atsFrameworkTerms = [
  "SOC 2",
  "ISO 27001",
  "NIST",
  "PCI-DSS",
  "GDPR",
  "HIPAA",
  "FedRAMP",
  "NYDFS",
  "OWASP",
  "MITRE ATT&CK",
];

const documentationTerms = ["documentation", "document", "runbook", "runbooks", "dashboards", "dashboard", "queries", "query", "playbook", "playbooks", "policy", "policies"];
const automationTerms = ["automation", "automations", "automated", "pipeline", "pipelines", "script", "scripts", "notebook", "jupyter", "engine", "analysis"];
const complianceTerms = ["soc 2", "iso 27001", "gdpr", "hipaa", "pci-dss", "compliance", "audit", "audits", "risk assessment", "policy", "policies"];
const trainingTerms = ["training", "awareness", "enablement", "workshop", "documentation", "onboarding"];
const cloudTerms = ["aws", "gcp", "azure", "kubernetes", "eks", "container", "containers", "devsecops", "iam", "infrastructure"];
const ownershipTerms = ["first security", "from scratch", "ground up", "strategy", "best practices", "own", "ownership", "shape", "startup"];
const responsibilityVerbs = [
  "own",
  "handle",
  "use",
  "collaborate",
  "develop",
  "contribute",
  "bridge",
  "write",
  "build",
  "improve",
  "investigate",
  "tune",
  "shadow",
  "support",
  "manage",
  "design",
  "create",
  "document",
  "analyze",
  "deliver",
];

const keywordDisplayOverrides: Record<string, string> = {
  ai: "AI",
  api: "API",
  apis: "APIs",
  aws: "AWS",
  azure: "Azure",
  cicd: "CI/CD",
  "ci/cd": "CI/CD",
  cloudtrail: "CloudTrail",
  datadog: "Datadog",
  eks: "EKS",
  gcp: "GCP",
  gdpr: "GDPR",
  iam: "IAM",
  "iso 27001": "ISO 27001",
  llm: "LLM",
  llms: "LLMs",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  okta: "Okta",
  "pci-dss": "PCI-DSS",
  python: "Python",
  rbac: "RBAC",
  saas: "SaaS",
  "soc 2": "SOC 2",
  spl: "SPL",
  sql: "SQL",
};

const STORAGE_KEY = "local-ats-scanner-history-v1";
const ACTIVE_SESSION_KEY = "local-ats-scanner-active-session-v1";
const SESSION_DB_NAME = "local-ats-scanner-session-db";
const SESSION_DB_STORE = "source-files";
const ACTIVE_SOURCE_PDF_KEY = "active-source-pdf";

const bulletActions = [
  "Engineered",
  "Automated",
  "Built",
  "Designed",
  "Hardened",
  "Operationalized",
  "Validated",
  "Shipped",
];

const bulletEvidence = [
  { metric: "5 workstreams", outcome: "improve review speed by 28%" },
  { metric: "7 recurring issues", outcome: "raise high-quality outcomes by 22%" },
  { metric: "12 reusable checks", outcome: "reduce manual rework by 35%" },
  { metric: "4 production-style workflows", outcome: "cut cycle time by 18%" },
  { metric: "9 handoff workflows", outcome: "accelerate owner follow-through by 30%" },
  { metric: "6 data sources", outcome: "strengthen decision quality across reviews" },
  { metric: "3 validation layers", outcome: "catch defects before delivery" },
  { metric: "10 dashboard signals", outcome: "make prioritization faster and more defensible" },
];

const templateOptions: TemplateOption[] = [
  { name: "Classic One-Page", fit: "Any field", strengths: ["ATS-safe headings", "dense impact bullets"] },
  ...domainProfiles
    .filter((profile) => profile.id !== "general")
    .map((profile) => ({
      name: profile.name.replace(" / ", " + "),
      fit: profile.roles.slice(0, 2).join(" / "),
      strengths: profile.coreTerms.slice(0, 3),
    })),
  { name: "Career Switcher", fit: "Transferable skills", strengths: ["projects", "keywords", "measurable impact"] },
  { name: "Early Career", fit: "Internship and entry-level", strengths: ["coursework", "projects", "skills proof"] },
  { name: "Senior Compact", fit: "Higher-scope roles", strengths: ["strategy", "leadership", "metrics"] },
  { name: "Strict Parser", fit: "Conservative ATS", strengths: ["plain text", "single column", "standard headings"] },
];

function buildBulletBank() {
  const generated: SampleBullet[] = [];
  for (const profile of domainProfiles.filter((item) => item.id !== "general")) {
    for (const category of profile.categories.slice(0, 4)) {
      const role = profile.roles[profile.categories.indexOf(category) % profile.roles.length] ?? profile.roles[0];
      const system = profile.systems[0] || profile.coreTerms[0] || "core systems";
      const outcome = profile.outcomes[profile.categories.indexOf(category) % profile.outcomes.length] || "improve review quality";
      const tags = unique([...profile.coreTerms.slice(0, 6), category.toLowerCase()]);
      const patterns = [
        `Translated ${category.toLowerCase()} requirements into ${system} checks, documenting owners, exceptions, and follow-through so teams could ${outcome}.`,
        `Improved ${category.toLowerCase()} operations by tightening ${system} review paths and turning recurring findings into prioritized remediation evidence.`,
        `Built a practical ${category.toLowerCase()} review flow in ${system}, connecting technical findings with clear handoffs, decisions, and measurable outcomes.`,
        `Standardized ${category.toLowerCase()} evidence in ${system}, making recurring reviews easier to audit, explain, and improve without keyword-heavy wording.`,
      ];
      for (const bullet of patterns) generated.push({ role, category, tags, bullet });
    }
  }
  return generated;
}

const sampleBulletBank = buildBulletBank();
const defaultDomainProfile = domainProfiles.find((item) => item.id === "general") ?? domainProfiles[domainProfiles.length - 1]!;
const EMPTY_ROLE_BLUEPRINT: RoleBlueprint = {
  targetRole: "Unscanned role",
  roleThesis: "Run a scan to build a role-specific proof blueprint.",
  proofPillars: [],
  atsFocus: [],
  rewriteStrategy: [],
  humanWarnings: [],
};
const EMPTY_EVIDENCE_GRAPH: EvidenceGraph = {
  employers: [],
  dates: [],
  degrees: [],
  certifications: [],
  toolsMentioned: [],
  frameworks: [],
  metrics: [],
  actionsTaken: [],
  scope: [],
  roles: [],
  sectionTools: {},
};
const EMPTY_ATS_RESULT: AtsResult = {
  passed: false,
  checks: [],
  anchors: [],
  matchedAnchors: [],
  missingAnchors: [],
  anchorCoverageScore: 0,
  dateFormats: [],
  resumeHeaderRole: "",
  jdRoleTitle: "",
};
const EMPTY_HUMAN_RESULT: HumanResult = {
  score: 0,
  band: "risk",
  subscores: {
    coherence: 0,
    specificity: 0,
    antiStuffing: 0,
    evidence: 0,
    metrics: 0,
    orphans: 0,
  },
  diagnostics: [],
};
const EMPTY_ANALYSIS: Analysis = {
  overall: 0,
  projected: 0,
  ats: EMPTY_ATS_RESULT,
  human: EMPTY_HUMAN_RESULT,
  domain: defaultDomainProfile,
  roleBlueprint: EMPTY_ROLE_BLUEPRINT,
  evidenceGraph: EMPTY_EVIDENCE_GRAPH,
  cards: [],
  gates: [],
  targetingSignals: [],
  issues: [],
  proChecks: [],
  bulletReviews: [],
  matchedKeywords: [],
  missingKeywords: [],
  repeatedVerbs: [],
  quantified: { quantified: 0, total: 0 },
  hygiene: { orphanFragments: [], metricLeadCount: 0, metricLeadTotal: 0 },
  bullets: [],
};

let pdfRuntimePromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfRuntime() {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.mjs?url")]).then(([pdfjsLib, pdfWorker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
      return pdfjsLib;
    });
  }
  return pdfRuntimePromise;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w+#./&-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[./&-]+|[./&-]+$/g, ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(normalizedText: string, term: string) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(^| )${escapeRegExp(normalizedTerm)}($| )`, "i").test(normalizedText);
}

function scoreFromRatio(ratio: number) {
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function profileTerms(profile: DomainProfile) {
  return unique([...profile.coreTerms, ...profile.signals, ...profile.categories.map((item) => item.toLowerCase()), ...genericAtsTerms]);
}

function detectDomain(text: string) {
  const normalized = normalize(text);
  let bestProfile = domainProfiles[domainProfiles.length - 1];
  let bestScore = 0;
  for (const profile of domainProfiles.filter((item) => item.id !== "general")) {
    const terms = [...profile.signals, ...profile.coreTerms, ...profile.roles];
    const score = terms.reduce((sum, term) => {
      const normalizedTerm = normalize(term);
      if (!normalizedTerm) return sum;
      if (containsTerm(normalized, normalizedTerm)) return sum + (normalizedTerm.includes(" ") ? 3 : 1);
      return sum;
    }, 0);
    if (score > bestScore) {
      bestProfile = profile;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? bestProfile : domainProfiles.find((item) => item.id === "general") ?? bestProfile;
}

function keywordValueScore(term: string, profileWordSet: Set<string>) {
  const words = normalize(term).split(" ").filter(Boolean);
  if (!words.length) return 0;
  const profileHits = words.filter((word) => profileWordSet.has(word)).length;
  const longWords = words.filter((word) => word.length >= 6).length;
  const technicalShape = words.some((word) => /[+#./-]|\d/.test(word));
  const genericHits = words.filter((word) => genericAtsTerms.some((termItem) => normalize(termItem).split(" ").includes(word))).length;
  const allGeneric = genericHits === words.length;
  return profileHits * 5 + longWords * 1.5 + (technicalShape ? 3 : 0) + (words.length === 2 ? 1 : 0) - (allGeneric ? 2 : 0);
}

function keywordWords(text: string) {
  return normalize(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function usefulSingleKeyword(word: string, profileWordSet: Set<string>) {
  if (word.length < 4 || stopWords.has(word)) return false;
  if (weakSingleKeywordTerms.has(word) || forbiddenKeywordFragments.has(word)) return false;
  if (profileWordSet.has(word)) return true;
  if (/[+#./-]|\d/.test(word)) return true;
  return word.length >= 6;
}

const forbiddenKeywordFragments = new Set([
  "accelerate",
  "accelerates",
  "accelerating",
  "business",
  "capabilities",
  "candidate",
  "department",
  "environment",
  "filing",
  "impact",
  "interview",
  "maintain",
  "maintains",
  "maintaining",
  "make",
  "medium",
  "mercor",
  "position",
  "power",
  "replace",
  "replaces",
  "replacing",
  "unit",
]);

const weakSingleKeywordTerms = new Set([
  "capabilities",
  "collaboration",
  "environment",
  "implementation",
  "interview",
  "maintain",
  "reporting",
  "requirements",
  "strategy",
  "work",
]);

const phraseVerbFragments = new Set([
  "automate",
  "automated",
  "build",
  "built",
  "configure",
  "configured",
  "designed",
  "develop",
  "developed",
  "document",
  "documented",
  "implement",
  "implemented",
  "maintain",
  "maintained",
  "manage",
  "managed",
  "perform",
  "performed",
  "support",
  "supported",
]);

const preferredCompoundTerms = [
  "access review",
  "audit readiness",
  "cloud security",
  "continuous improvement",
  "detection engineering",
  "incident response",
  "security automation",
  "security configuration",
  "security documentation",
  "security infrastructure",
  "security strategy",
  "vulnerability lifecycle",
];

const badKeywordBoundaryWords = new Set([
  "accelerate",
  "accelerates",
  "applying",
  "build",
  "building",
  "filing",
  "replace",
  "replaces",
  "replacing",
  "ship",
  "ships",
  "write",
  "writes",
]);

function unnaturalKeywordPhrase(term: string) {
  const words = normalize(term).split(" ").filter(Boolean);
  if (!words.length) return true;
  if (words.length === 1) return weakSingleKeywordTerms.has(words[0]);
  if (words.some((word) => forbiddenKeywordFragments.has(word))) return true;
  if (words.some((word, index) => index > 0 && phraseVerbFragments.has(word))) return true;
  if (["develop", "maintain", "implement", "designed"].includes(words[0])) return true;
  if (/^(automation continuous improvement|security strategy designed|develop documentation|documentation security|capabilities security|knowledge cloud|layer security)$/i.test(words.join(" "))) {
    return true;
  }
  return false;
}

function naturalKeywordTerm(term: string, profile: DomainProfile) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return "";
  const words = normalizedTerm.split(" ").filter(Boolean);
  if (!words.length || words.length > 3) return "";
  if (unnaturalKeywordPhrase(normalizedTerm)) return "";
  if (words.some((word) => forbiddenKeywordFragments.has(word))) return "";
  if (badKeywordBoundaryWords.has(words[0]) || badKeywordBoundaryWords.has(words[words.length - 1])) return "";
  if (/^(security|automation|process|manual)$/.test(words[0]) && badKeywordBoundaryWords.has(words[1])) return "";
  if ([...knownToolTerms, ...complianceTerms, ...trainingTerms, ...cloudTerms].some((known) => normalize(known) === normalizedTerm)) return normalizedTerm;
  return usefulKeywordTerm(normalizedTerm, profile) ? normalizedTerm : "";
}

function displayKeywordTerm(term: string) {
  const normalizedTerm = normalize(term);
  if (keywordDisplayOverrides[normalizedTerm]) return keywordDisplayOverrides[normalizedTerm];
  return normalizedTerm
    .split(" ")
    .map((word) => keywordDisplayOverrides[word] ?? word)
    .join(" ");
}

function readableList(items: string[]) {
  const cleanItems = unique(items.map(displayKeywordTerm).filter(Boolean));
  if (cleanItems.length <= 1) return cleanItems[0] ?? "";
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems[cleanItems.length - 1]}`;
}

function safeRewriteTerms(terms: string[], profile: DomainProfile, maxTerms = 3) {
  return unique(terms.map((term) => naturalKeywordTerm(term, profile)).filter(Boolean)).slice(0, maxTerms);
}

function usefulKeywordTerm(term: string, profile: DomainProfile) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const words = normalizedTerm.split(" ").filter(Boolean);
  if (!words.length) return false;
  if (unnaturalKeywordPhrase(normalizedTerm)) return false;
  if (words.some((word) => forbiddenKeywordFragments.has(word))) return false;
  if (badKeywordBoundaryWords.has(words[0]) || badKeywordBoundaryWords.has(words[words.length - 1])) return false;
  if ([...knownToolTerms, ...complianceTerms, ...trainingTerms, ...cloudTerms].some((known) => normalize(known) === normalizedTerm)) return true;
  if (words.some((word) => ["accredited", "citizen", "citizenship", "eligible", "sponsorship"].includes(word))) return false;
  if (words.some((word) => ["bachelor", "degree", "gpa", "cgpa", "science", "university", "college"].includes(word))) return false;
  const profileWordSet = new Set(profileTerms(profile).flatMap((profileTerm) => normalize(profileTerm).split(" ")));
  if (words.length === 1) return usefulSingleKeyword(words[0], profileWordSet);
  const usefulWords = words.filter((word) => usefulSingleKeyword(word, profileWordSet));
  return usefulWords.length >= Math.min(2, words.length) && !words.every((word) => genericAtsTerms.some((genericTerm) => normalize(genericTerm).split(" ").includes(word)));
}

function mineJdPhrases(jd: string, profile: DomainProfile) {
  const profileWordSet = new Set(profileTerms(profile).flatMap((term) => normalize(term).split(" ")));
  const phraseCounts = new Map<string, number>();
  for (const compound of preferredCompoundTerms) {
    if (containsTerm(normalize(jd), compound)) phraseCounts.set(compound, 3);
  }
  const segments = jd
    .split(/[\n,;:|()]+/)
    .map((segment) => keywordWords(segment))
    .filter((segmentWords) => segmentWords.length >= 2);

  for (const words of segments) {
    for (let size = Math.min(3, words.length); size >= 2; size -= 1) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const phraseWords = words.slice(index, index + size);
        const phrase = phraseWords.join(" ");
        const hasRepeatedWord = new Set(phraseWords).size !== phraseWords.length;
        const hasUsefulShape = phraseWords.some((word) => word.length >= 5 || /[+#./-]|\d/.test(word));
        const hasForbiddenFragment = phraseWords.some((word) => forbiddenKeywordFragments.has(word));
        const hasVerbFragment = phraseWords.some((word, wordIndex) => wordIndex > 0 && phraseVerbFragments.has(word));
        const unnatural = unnaturalKeywordPhrase(phrase);
        const startsOrEndsGeneric =
          ["ability", "excellent", "strong", "proven", "knowledge"].includes(phraseWords[0]) ||
          ["role", "team", "work", "environment"].includes(phraseWords[phraseWords.length - 1]) ||
          badKeywordBoundaryWords.has(phraseWords[0]) ||
          badKeywordBoundaryWords.has(phraseWords[phraseWords.length - 1]);
        if (phrase.length <= 7 || hasRepeatedWord || !hasUsefulShape || hasForbiddenFragment || hasVerbFragment || unnatural || startsOrEndsGeneric) continue;
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return Array.from(phraseCounts.entries())
    .map(([phrase, count]) => ({ phrase, score: keywordValueScore(phrase, profileWordSet) + count * 1.2 }))
    .sort((a, b) => b.score - a.score || a.phrase.length - b.phrase.length)
    .map((item) => item.phrase);
}

function extractKeywords(jd: string, profile = detectDomain(jd)) {
  const normalized = normalize(jd);
  const words = keywordWords(jd);
  const domainPhrases = profileTerms(profile).filter((phrase) => containsTerm(normalized, phrase));
  const profileWordSet = new Set(profileTerms(profile).flatMap((term) => normalize(term).split(" ")));
  const minedPhrases = mineJdPhrases(jd, profile);

  const termCounts = new Map<string, number>();
  for (const word of words) termCounts.set(word, (termCounts.get(word) ?? 0) + 1);
  const rankedWords = Array.from(termCounts.entries())
    .filter(([word]) => !/^\d+$/.test(word) && usefulSingleKeyword(word, profileWordSet))
    .sort((a, b) => b[1] - a[1] || keywordValueScore(b[0], profileWordSet) - keywordValueScore(a[0], profileWordSet))
    .slice(0, 24)
    .map(([word]) => word);

  return unique([...domainPhrases, ...minedPhrases.slice(0, 20), ...rankedWords, ...genericAtsTerms.filter((term) => containsTerm(normalized, term))])
    .filter((term) => usefulKeywordTerm(term, profile))
    .slice(0, 45);
}

const requiredAtsSectionGroups = [
  ["experience", "professional experience", "work experience", "employment", "work history"],
  ["education", "academic background", "academic"],
  ["skills", "technical skills", "core competencies", "competencies"],
];

const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const phonePattern = /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const monthPattern = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const dateRangePatterns = [
  {
    label: "Mon YYYY - Mon YYYY",
    pattern: new RegExp(`\\b${monthPattern}\\s+\\d{4}\\s*[-â€“â€”]\\s*(?:${monthPattern}\\s+\\d{4}|present|current)\\b`, "gi"),
  },
  {
    label: "MM/YYYY - MM/YYYY",
    pattern: /\b(?:0?[1-9]|1[0-2])\/\d{4}\s*[-â€“â€”]\s*(?:(?:0?[1-9]|1[0-2])\/\d{4}|present|current)\b/gi,
  },
  {
    label: "YYYY - YYYY",
    pattern: /\b(?:19|20)\d{2}\s*[-â€“â€”]\s*(?:(?:19|20)\d{2}|present|current)\b/gi,
  },
];

const roleTitleKeywords = [
  "engineer",
  "analyst",
  "manager",
  "designer",
  "developer",
  "architect",
  "specialist",
  "coordinator",
  "director",
  "lead",
  "officer",
  "consultant",
  "associate",
  "scientist",
  "researcher",
  "technician",
  "administrator",
];

const acronymExclusions = new Set(["AND", "OR", "FOR", "THE", "WITH", "USA", "CEO", "CTO", "VP"]);

function checkAtsSectionHeaders(resume: string): AtsCheck {
  const lower = resume.toLowerCase();
  const missing = requiredAtsSectionGroups.filter((group) => !group.some((alternative) => lower.includes(alternative))).map((group) => group[0]);
  return {
    key: "sections",
    label: "Standard Section Headers",
    passed: missing.length === 0,
    detail: missing.length ? `Missing standard section header(s): ${missing.join(", ")}.` : "Experience, Education, and Skills headers are parseable.",
    missing,
  };
}

function checkAtsContact(resume: string): AtsCheck {
  const hasEmail = emailPattern.test(resume);
  const hasPhone = phonePattern.test(resume);
  const missing = [hasEmail ? "" : "email", hasPhone ? "" : "phone"].filter(Boolean);
  return {
    key: "contact",
    label: "Contact Info Parseable",
    passed: hasEmail && hasPhone,
    detail: hasEmail && hasPhone ? "Email and phone match standard ATS regex patterns." : `Missing parseable ${missing.join(" and ")}.`,
    missing,
  };
}

function detectDateFormats(resume: string) {
  const monthRangePattern = new RegExp(`\\b${monthPattern}\\s+\\d{4}\\s*[-â€“â€”]\\s*(?:${monthPattern}\\s+\\d{4}|present|current)\\b`, "gi");
  const slashRangePattern = /\b(?:0?[1-9]|1[0-2])\/\d{4}\s*[-â€“â€”]\s*(?:(?:0?[1-9]|1[0-2])\/\d{4}|present|current)\b/gi;
  const monthMatches = resume.match(monthRangePattern) ?? resume.match(dateRangePatterns[0].pattern) ?? [];
  const slashMatches = resume.match(slashRangePattern) ?? resume.match(dateRangePatterns[1].pattern) ?? [];
  const scrubbed = resume.replace(monthRangePattern, " ").replace(dateRangePatterns[0].pattern, " ").replace(slashRangePattern, " ").replace(dateRangePatterns[1].pattern, " ");
  const yearMatches = scrubbed.match(/(?<![A-Za-z]\s)\b(?:19|20)\d{2}\s*[-â€“â€”-]\s*(?:(?:19|20)\d{2}|present|current)\b/gi) ?? [];
  return [
    { label: "Mon YYYY - Mon YYYY", matches: monthMatches },
    { label: "MM/YYYY - MM/YYYY", matches: slashMatches },
    { label: "YYYY - YYYY", matches: yearMatches },
  ].filter((item) => item.matches.length > 0);
}

function checkAtsDateConsistency(resume: string): AtsCheck {
  const formats = detectDateFormats(resume);
  const labels = formats.map((item) => item.label);
  if (!formats.length) {
    return {
      key: "dates",
      label: "Date Format Consistency",
      passed: false,
      detail: "No standard date ranges were detected. Use one format like Jan 2024 - Mar 2025.",
      missing: ["date ranges"],
    };
  }
  return {
    key: "dates",
    label: "Date Format Consistency",
    passed: formats.length === 1,
    detail:
      formats.length === 1
        ? `All detected date ranges use ${formats[0].label}.`
        : `Mixed date formats detected: ${labels.join(", ")}. Pick one format and use it everywhere.`,
    missing: formats.length === 1 ? [] : labels,
  };
}

function detectRawOrphanFragments(resume: string) {
  return normalizeResumeLines(resume)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 80 && /^[a-z]/.test(line) && /[.!?]$/.test(line));
}

function checkAtsFormatCompliance(resume: string): AtsCheck {
  const textLengthOk = resume.trim().length >= 500;
  const specialChars = (resume.match(/[^A-Za-z0-9\s]/g) ?? []).length;
  const density = resume.length ? specialChars / resume.length : 1;
  const densityOk = density < 0.2;
  const orphanFragments = detectRawOrphanFragments(resume);
  const orphanOk = orphanFragments.length <= 2;
  const barePunctuationLines = normalizeResumeLines(resume).filter((line) => /^[,;]/.test(line.trim()));
  const punctuationOk = barePunctuationLines.length === 0;
  const failures = [
    textLengthOk ? "" : "resume text under 500 characters",
    densityOk ? "" : `special character density ${Math.round(density * 100)}%`,
    orphanOk ? "" : `${orphanFragments.length} orphan fragments`,
    punctuationOk ? "" : `${barePunctuationLines.length} bare punctuation starts`,
  ].filter(Boolean);
  return {
    key: "format",
    label: "Format Compliance",
    passed: failures.length === 0,
    detail: failures.length ? failures.join("; ") : "Text length, character density, orphan fragments, and punctuation starts are ATS-safe.",
    missing: failures,
  };
}

function requiredQualificationText(jd: string) {
  const lines = normalizeResumeLines(jd);
  const start = lines.findIndex((line) => /\b(requirements?|qualifications?|what we're looking for|what we are looking for|preferred qualifications?)\b/i.test(line));
  if (start < 0) return jd;
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /\b(responsibilities|benefits|about|why|compensation|equal opportunity|nice to have|bonus)\b/i.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end).join("\n");
}

function countTermOccurrences(text: string, term: string) {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);
  if (!normalizedText || !normalizedTerm) return 0;
  const matches = normalizedText.match(new RegExp(`(^| )${escapeRegExp(normalizedTerm)}($| )`, "gi"));
  return matches?.length ?? 0;
}

function extractAcronymCounts(text: string) {
  const counts = new Map<string, number>();
  for (const match of text.match(/\b[A-Z][A-Z0-9&/+.-]{1,}\b/g) ?? []) {
    const clean = match.replace(/[./-]+$/g, "");
    if (clean.length < 2 || acronymExclusions.has(clean)) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return counts;
}

function frameworkPresent(text: string, framework: string) {
  const normalizedText = normalize(text);
  const patternMap: Record<string, RegExp> = {
    "SOC 2": /\bsoc\s*2\b/i,
    "ISO 27001": /\biso\s*27001\b/i,
    NIST: /\bnist\b/i,
    "PCI-DSS": /\bpci[-\s]?dss\b/i,
    GDPR: /\bgdpr\b/i,
    HIPAA: /\bhipaa\b/i,
    FedRAMP: /\bfedramp\b/i,
    NYDFS: /\bnydfs\b/i,
    OWASP: /\bowasp\b/i,
    "MITRE ATT&CK": /\bmitre\b|\batt&ck\b|\battack\b/i,
  };
  return patternMap[framework]?.test(text) || containsTerm(normalizedText, framework);
}

function extractNounPhraseAnchors(requiredText: string) {
  const phrases = new Map<string, number>();
  const segments = requiredText
    .split(/[\n,;:()]+/)
    .map((segment) => keywordWords(segment))
    .filter((words) => words.length >= 2);
  for (const words of segments) {
    for (let size = Math.min(4, words.length); size >= 2; size -= 1) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const phraseWords = words.slice(index, index + size);
        const phrase = phraseWords.join(" ");
        if (phrase.length < 8 || phrase.length > 40) continue;
        if (stopWords.has(phraseWords[0]) || stopWords.has(phraseWords[phraseWords.length - 1])) continue;
        if (phraseWords.some((word) => forbiddenKeywordFragments.has(word))) continue;
        if (!phraseWords.some((word) => word.length >= 5 || /[+#./-]|\d/.test(word))) continue;
        phrases.set(phrase, Math.max(phrases.get(phrase) ?? 0, 1 + 0.3 * phraseWords.length));
      }
    }
  }
  return phrases;
}

function extractAtsAnchors(jd: string) {
  const requiredText = requiredQualificationText(jd);
  const requiredNorm = normalize(requiredText);
  const candidates = new Map<string, number>();

  for (const term of atsAnchorToolTerms) {
    const count = countTermOccurrences(jd, term);
    if (!count) continue;
    candidates.set(displayKeywordTerm(term), count * 3 + (containsTerm(requiredNorm, term) ? 5 : 0));
  }

  const allAcronyms = extractAcronymCounts(jd);
  const requiredAcronyms = extractAcronymCounts(requiredText);
  for (const [acronym, count] of allAcronyms.entries()) {
    if (count < 2) continue;
    candidates.set(acronym, count * 2 + (requiredAcronyms.has(acronym) ? 3 : 0));
  }

  for (const framework of atsFrameworkTerms) {
    if (frameworkPresent(jd, framework)) candidates.set(framework, Math.max(candidates.get(framework) ?? 0, 5));
  }

  for (const [phrase, score] of extractNounPhraseAnchors(requiredText).entries()) {
    candidates.set(displayKeywordTerm(phrase), Math.max(candidates.get(displayKeywordTerm(phrase)) ?? 0, score));
  }

  const ranked = Array.from(candidates.entries())
    .map(([term, score]) => ({ term, score, norm: normalize(term) }))
    .filter((item) => item.norm)
    .sort((a, b) => b.score - a.score || a.term.length - b.term.length);

  const deduped: string[] = [];
  for (const item of ranked) {
    const isSubstring = deduped.some((existing) => {
      const existingNorm = normalize(existing);
      return existingNorm.includes(item.norm) || item.norm.includes(existingNorm);
    });
    if (!isSubstring) deduped.push(item.term);
    if (deduped.length >= 8) break;
  }

  if (deduped.length < 5) {
    for (const term of extractKeywords(jd).map(displayKeywordTerm)) {
      if (!deduped.some((existing) => normalize(existing) === normalize(term))) deduped.push(term);
      if (deduped.length >= 5) break;
    }
  }

  return deduped.slice(0, 8);
}

function checkAtsAnchorCoverage(resume: string, jd: string) {
  const anchors = extractAtsAnchors(jd);
  const resumeNorm = normalize(resume);
  const matchedAnchors = anchors.filter((anchor) => containsTerm(resumeNorm, anchor));
  const missingAnchors = anchors.filter((anchor) => !containsTerm(resumeNorm, anchor));
  const coverage = anchors.length ? matchedAnchors.length / anchors.length : 0;
  return {
    check: {
      key: "anchors",
      label: "Anchor Coverage",
      passed: coverage >= 0.7,
      detail: anchors.length
        ? `${matchedAnchors.length}/${anchors.length} distinctive JD anchors matched.`
        : "No distinctive JD anchors could be extracted.",
      missing: missingAnchors,
    } satisfies AtsCheck,
    anchors,
    matchedAnchors,
    missingAnchors,
    anchorCoverageScore: scoreFromRatio(coverage),
  };
}

function roleKeywordsFromText(text: string) {
  const normalizedText = normalize(text);
  return roleTitleKeywords.filter((keyword) => containsTerm(normalizedText, keyword));
}

function extractJdRoleTitle(jd: string) {
  return normalizeResumeLines(jd).find((line) => line.trim().length > 4) ?? "";
}

function extractResumeHeaderRole(resume: string) {
  const lines = normalizeResumeLines(resume)
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryIndex = lines.findIndex((line) => /^summary$/i.test(line));
  const headerLines = lines.slice(0, summaryIndex >= 0 ? summaryIndex : Math.min(4, lines.length));
  return headerLines.find((line, index) => index > 0 && roleKeywordsFromText(line).length > 0) ?? headerLines.find((line) => roleKeywordsFromText(line).length > 0) ?? "";
}

function checkAtsRoleCompatibility(resume: string, jd: string): AtsCheck & { resumeHeaderRole: string; jdRoleTitle: string } {
  const jdRoleTitle = extractJdRoleTitle(jd);
  const resumeHeaderRole = extractResumeHeaderRole(resume);
  const jdKeywords = roleKeywordsFromText(jdRoleTitle);
  const resumeKeywords = roleKeywordsFromText(resumeHeaderRole);
  const compatible = !jdKeywords.length || jdKeywords.some((keyword) => resumeKeywords.includes(keyword));
  return {
    key: "role",
    label: "Role Title Compatibility",
    passed: compatible && Boolean(resumeHeaderRole || !jdKeywords.length),
    detail:
      compatible && resumeHeaderRole
        ? `Header role "${resumeHeaderRole}" is compatible with JD title "${jdRoleTitle}".`
        : compatible
          ? "No clear JD role keyword was detected, so role-title compatibility is not blocking."
          : `Header role "${resumeHeaderRole || "not found"}" does not match JD title "${jdRoleTitle}".`,
    missing: compatible ? [] : jdKeywords,
    resumeHeaderRole,
    jdRoleTitle,
  };
}

function runDeterministicAtsChecks(resume: string, jd: string): AtsResult {
  const sectionCheck = checkAtsSectionHeaders(resume);
  const contactCheck = checkAtsContact(resume);
  const dateCheck = checkAtsDateConsistency(resume);
  const formatCheck = checkAtsFormatCompliance(resume);
  const anchorResult = checkAtsAnchorCoverage(resume, jd);
  const roleCheck = checkAtsRoleCompatibility(resume, jd);
  const checks = [sectionCheck, contactCheck, dateCheck, formatCheck, anchorResult.check, roleCheck];
  return {
    passed: checks.every((check) => check.passed),
    checks,
    anchors: anchorResult.anchors,
    matchedAnchors: anchorResult.matchedAnchors,
    missingAnchors: anchorResult.missingAnchors,
    anchorCoverageScore: anchorResult.anchorCoverageScore,
    dateFormats: detectDateFormats(resume).map((item) => item.label),
    resumeHeaderRole: roleCheck.resumeHeaderRole,
    jdRoleTitle: roleCheck.jdRoleTitle,
  };
}

function startsNewImpactLine(line: string) {
  const clean = cleanResumeLine(line);
  const first = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  return /^(?:\u2022|[-*])\s*/.test(line.trim()) || actionVerbs.includes(first);
}

function isImpactVisualLine(line: string) {
  const clean = cleanResumeLine(line);
  const first = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  const isDateLine = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4})/i.test(clean);
  const looksLikeRoleLine = clean.includes("|") && !actionVerbs.includes(first);
  const isHeading = clean.length < 90 && /^[A-Z0-9 &/|,.+-]+$/.test(clean);
  return clean.length > 18 && !isDateLine && !looksLikeRoleLine && !isHeading;
}

function isContinuationVisualLine(previous: string, line: string) {
  const clean = cleanResumeLine(line);
  if (!previous || !clean || /^(?:\u2022|[-*])\s*/.test(line.trim())) return false;
  const first = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  const previousOpen = !/[.!?]$/.test(previous.trim());
  const previousOpenList = /[:;,]\s*[^.!?]*$/.test(previous) || /\b(?:and|or|with|using|via|through|across|into|for|by|to)$/i.test(previous.trim());
  const startsLower = /^[a-z]/.test(clean);
  const startsDangling = fragmentLeadWords.has(first);
  const shortTail = clean.length < 70 && /[.!?]$/.test(clean) && !actionVerbs.includes(first);
  return startsLower || startsDangling || shortTail || (previousOpen && previousOpenList);
}

function parseLogicalImpactBullets(resume: string) {
  const bullets: string[] = [];
  let inImpactSection = false;
  let current = "";

  for (const rawLine of resume.split(/\n+/)) {
    const line = rawLine.trim();
    const upper = line.toUpperCase();
    if (!line) continue;

    if (/^(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|PROJECTS|PROJECT EXPERIENCE|ACTIVITIES)$/.test(upper)) {
      if (current) bullets.push(current);
      current = "";
      inImpactSection = true;
      continue;
    }

    if (/^(SUMMARY|SKILLS|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS|CONTACT|AWARDS)$/.test(upper)) {
      if (current) bullets.push(current);
      current = "";
      inImpactSection = false;
      continue;
    }

    if (!inImpactSection || !isImpactVisualLine(line)) continue;

    const clean = cleanResumeLine(line);
    if (current && isContinuationVisualLine(current, line)) {
      current = `${current} ${clean}`.replace(/\s+/g, " ").trim();
      continue;
    }

    if (startsNewImpactLine(line)) {
      if (current) bullets.push(current);
      current = clean;
      continue;
    }

    if (current) current = `${current} ${clean}`.replace(/\s+/g, " ").trim();
  }

  if (current) bullets.push(current);
  return bullets.filter((bullet) => bullet.length > 35);
}

function extractBullets(resume: string) {
  return parseLogicalImpactBullets(resume);
}

const fragmentLeadWords = new Set([
  "and",
  "as",
  "by",
  "for",
  "from",
  "including",
  "into",
  "remediation",
  "telemetry",
  "through",
  "to",
  "using",
  "via",
  "vulnerability",
  "vulnerabilities",
  "with",
  "workflow",
  "workflows",
  "privilege",
  "investigation",
  "indirect",
]);

function cleanResumeLine(line: string) {
  return line.replace(/^(?:\u2022|[-*])\s*/, "").trim();
}

function isLikelyOrphanFragmentLine(line: string, index: number) {
  const clean = cleanResumeLine(line);
  if (clean.length < 24) return false;
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!firstWord || actionVerbs.includes(firstWord)) return false;
  if (/^(?:\u2022|[-*])\s*/.test(line)) return false;
  if (isProtectedHeading(line) || isFixedFactLine(line, index)) return false;
  if (clean.includes("|")) return false;
  if (/^[A-Z][A-Za-z0-9 .,&'()/-]{2,90}$/.test(clean) && !/[.;:]$/.test(clean)) return false;
  const startsLower = /^[a-z]/.test(clean);
  const startsDangling = fragmentLeadWords.has(firstWord);
  const hasDanglingPunctuation = /;\s*[a-z]/.test(clean) || /,\s*(and|or|with|for|into|using)\b/i.test(clean);
  const lacksSentenceSubject = !/\b(engineered|built|developed|implemented|automated|designed|validated|investigated|managed|created|reduced|improved|delivered|documented|trained)\b/i.test(clean);
  return startsDangling || (startsLower && (hasDanglingPunctuation || lacksSentenceSubject));
}

function detectOrphanFragments(resume: string) {
  return parseLogicalImpactBullets(resume)
    .filter((bullet, index) => isLikelyOrphanFragmentLine(bullet, index))
    .map((bullet) => compactText(cleanResumeLine(bullet), 120));
}

function metricLeadStats(bullets: string[]) {
  const metricLeadCount = bullets.filter((bullet) => {
    const lead = bullet.split(/[.;:]/)[0]?.slice(0, 120) ?? bullet.slice(0, 120);
    return hasNumbers(lead);
  }).length;
  return { metricLeadCount, metricLeadTotal: bullets.length };
}

function metricClaims(text: string) {
  return (
    text.match(
      /\b\d+(?:\.\d+)?%?\+?(?:\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|alerts?|cases?|tickets?|findings?|checks?|workflows?|pipelines?|rules?|detections?|sources?|dashboards?|queries?|users?|requests?|incidents?|events?|controls?|reviews?))?/gi,
    ) ?? []
  )
    .map((claim) => claim.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function evidenceTermsForResume(resume: string, profile: DomainProfile) {
  const normalized = normalize(resume);
  const candidateTerms = unique([
    ...knownToolTerms,
    ...complianceTerms,
    ...cloudTerms,
    ...profile.coreTerms,
    ...profile.signals,
  ]);
  return candidateTerms
    .filter((term) => containsTerm(normalized, term))
    .map(displayKeywordTerm)
    .sort((a, b) => a.localeCompare(b));
}

function isEvidenceSectionHeading(line: string) {
  return /^(SUMMARY|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|PROJECTS|PROJECT EXPERIENCE|ACTIVITIES|SKILLS|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS|CONTACT|AWARDS)$/i.test(
    line.trim(),
  );
}

function isExperienceSection(section: string) {
  return /^(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE)$/i.test(section);
}

function isProjectSection(section: string) {
  return /^(PROJECTS|PROJECT EXPERIENCE)$/i.test(section);
}

function isRoleContextLine(line: string) {
  const trimmed = line.trim();
  const firstWord = cleanResumeLine(trimmed).split(/\s+/)[0]?.toLowerCase() ?? "";
  return (
    trimmed.includes("|") &&
    trimmed.length <= 160 &&
    !/@/.test(trimmed) &&
    !actionVerbs.includes(firstWord) &&
    !/\b(?:university|college|school|degree|gpa|cgpa|certification|certified)\b/i.test(trimmed)
  );
}

function isProjectTitleLine(line: string) {
  const clean = cleanResumeLine(line);
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!clean || startsNewImpactLine(line)) return false;
  if (clean.length > 130 || /[.!?]$/.test(clean) || actionVerbs.includes(firstWord)) return false;
  return /^[A-Z0-9][A-Za-z0-9 .,&'()/:+#-]{4,}$/.test(clean);
}

function rolePartsFromLine(line: string) {
  const [left, right = ""] = line.split("|").map((part) => part.trim());
  const date = right.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/i)?.[0] ?? "";
  const titleEmployer = left.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    title: titleEmployer[0] || left || "Role",
    employer: titleEmployer.slice(1).join(", ") || right.replace(date, "").trim() || "Employer",
    dates: date,
  };
}

function evidenceActionPhrases(lines: string[]) {
  return unique(
    lines
      .map((line) => cleanResumeLine(line))
      .filter((line) => line.length > 20)
      .map((line) => line.split(/\s+/).slice(0, 8).join(" "))
      .filter((phrase) => actionVerbs.includes(phrase.split(/\s+/)[0]?.toLowerCase() ?? "")),
  );
}

function evidenceObjects(text: string, profile: DomainProfile) {
  const normalized = normalize(text);
  const objectTerms = unique([
    ...profile.categories,
    ...profile.systems,
    ...profile.outcomes,
    "alerts",
    "incidents",
    "detections",
    "identity telemetry",
    "access reviews",
    "dashboards",
    "queries",
    "pipelines",
    "workflows",
    "runbooks",
    "vulnerabilities",
    "cloud control plane",
    "authentication events",
    "remediation",
  ]);
  return objectTerms.filter((term) => containsTerm(normalized, term)).map(displayKeywordTerm).slice(0, 30);
}

function evidenceOutcomes(lines: string[]) {
  return unique(
    lines
      .map((line) => cleanResumeLine(line))
      .filter((line) => /\b(?:reduc|improv|accelerat|strengthen|increase|decrease|cut|lower|raise|faster|accuracy|time|noise|quality|coverage)\w*\b/i.test(line))
      .map((line) => compactText(line, 140)),
  ).slice(0, 20);
}

function evidenceScope(lines: string[]) {
  return unique(
    lines
      .map((line) => cleanResumeLine(line))
      .filter((line) => /\b(?:own|owned|ownership|lead|led|architect|architected|designed|built|end-to-end|from scratch|strategy|managed|shipped|delivered|primary|complete)\b/i.test(line))
      .map((line) => compactText(line, 140)),
  ).slice(0, 16);
}

function roleEvidenceFromRange(lines: string[], startLine: number, endLine: number, section: string, title: string, employer: string, dates: string, profile: DomainProfile) {
  const rangeText = lines.slice(startLine - 1, endLine).join("\n");
  const rangeLines = lines.slice(startLine - 1, endLine).map((line) => line.trim()).filter(Boolean);
  const dateHits = rangeText.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/gi) ?? [];
  const cleanDates = dates || unique(dateHits)[0] || "";
  return {
    id: `${section}-${startLine}-${normalize(`${title}-${employer}`).slice(0, 36)}`,
    employer,
    title,
    dates: cleanDates,
    section,
    startLine,
    endLine,
    allowedTools: evidenceTermsForResume(rangeText, profile).slice(0, 40),
    allowedMetrics: unique(metricClaims(rangeText)).slice(0, 40),
    allowedActions: evidenceActionPhrases(rangeLines).slice(0, 40),
    allowedObjects: evidenceObjects(rangeText, profile),
    allowedOutcomes: evidenceOutcomes(rangeLines),
    scopeEvidence: evidenceScope(rangeLines),
  };
}

function buildEvidenceGraph(resume: string, profile: DomainProfile): EvidenceGraph {
  const lines = normalizeResumeLines(resume);
  const toolsMentioned = unique(evidenceTermsForResume(resume, profile)).slice(0, 80);
  const dates = unique(
    resume.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4})\b/gi) ?? [],
  ).slice(0, 18);
  const degrees = unique(
    lines
      .map((line) => line.trim())
      .filter((line) => /\b(?:bachelor|master|ph\.?d|university|college|school|degree|gpa|cgpa|b\.?tech|m\.?s\.?|b\.?s\.?)\b/i.test(line)),
  ).slice(0, 12);
  const certifications = unique(
    lines
      .map((line) => line.trim())
      .filter((line) => /\b(?:certification|certified|certificate|aws certified|security\+|cissp|cysa|ccna|az-\d+)\b/i.test(line)),
  ).slice(0, 12);
  const employers = unique(
    lines
      .map((line) => line.trim())
      .filter((line) => line.includes("|") && line.length <= 140 && !/@/.test(line) && !/\b(?:university|college|school|degree|gpa|cgpa)\b/i.test(line)),
  ).slice(0, 18);
  const bullets = extractBullets(resume);
  const metrics = unique(bullets.flatMap(metricClaims)).slice(0, 80);
  const actionsTaken = evidenceActionPhrases(bullets).slice(0, 80);
  const frameworks = unique(complianceTerms.filter((term) => containsTerm(normalize(resume), term)).map(displayKeywordTerm)).slice(0, 40);
  const scope = evidenceScope(bullets).slice(0, 40);

  const roles: RoleEvidence[] = [];
  let section = "";
  let active:
    | {
        startLine: number;
        section: string;
        title: string;
        employer: string;
        dates: string;
      }
    | null = null;
  const closeActive = (endLine: number) => {
    if (!active || endLine < active.startLine) return;
    roles.push(roleEvidenceFromRange(lines, active.startLine, endLine, active.section, active.title, active.employer, active.dates, profile));
    active = null;
  };

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    const upper = trimmed.toUpperCase();
    if (!trimmed) return;
    if (isEvidenceSectionHeading(trimmed)) {
      closeActive(index);
      section = upper;
      if (isProjectSection(section)) {
        active = {
          startLine: index + 1,
          section,
          title: "Project Portfolio",
          employer: "Projects",
          dates: "",
        };
      }
      return;
    }
    if (isExperienceSection(section) && isRoleContextLine(trimmed)) {
      closeActive(index);
      const role = rolePartsFromLine(trimmed);
      active = {
        startLine: index + 1,
        section,
        title: role.title,
        employer: role.employer,
        dates: role.dates,
      };
    }
  });
  closeActive(lines.length);

  const sectionTools: Record<string, string[]> = {};
  let currentSection = "Header";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isProtectedHeading(trimmed)) {
      currentSection = trimmed;
      continue;
    }
    const lineTerms = evidenceTermsForResume(trimmed, profile);
    if (lineTerms.length) {
      sectionTools[currentSection] = unique([...(sectionTools[currentSection] ?? []), ...lineTerms]).slice(0, 30);
    }
  }

  return {
    employers,
    dates,
    degrees,
    certifications,
    toolsMentioned,
    frameworks,
    metrics,
    actionsTaken,
    scope,
    roles,
    sectionTools,
  };
}

function hasNumbers(text: string) {
  return /(\d+%?|\d+\+|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b)/i.test(text);
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function sentenceCase(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function sentenceQualityRisk(text: string) {
  const normalized = normalize(text);
  let risk = 0;

  if (/\bapplying\s+\w+(?:\s+\w+)?(?:,\s*\w+(?:\s+\w+)?){3,}/i.test(text)) risk += 35;
  if (/\b(?:applying|using)\s+mercor\b/i.test(text)) risk += 35;
  if (/\b(?:accelerate|accelerates|replaces|replacing)\s+\w+/i.test(text)) risk += 25;
  if (/\bsecurity automation replaces\b/i.test(normalized)) risk += 35;
  if (/\bsecurity strategy designed\b/i.test(normalized)) risk += 35;
  if (/\bcollaboration operating rhythm\b/i.test(normalized)) risk += 30;
  if (/\bconnect(?:ing)? a specific system\b/i.test(text)) risk += 30;
  if (/\bacross \d+ (?:workstreams|deliverables|items|review paths|signal sources)\b/i.test(text)) risk += 15;
  if (/\b(?:6 deliverables|5 control checks|7 recurring validation points)\b/i.test(text)) risk += 10;

  const commaCount = (text.match(/,/g) ?? []).length;
  if (commaCount >= 5) risk += 18;

  const words = countWords(text);
  if (words > 42) risk += 20;
  else if (words > 34) risk += 10;

  return Math.min(100, risk);
}

function repeatedLongPhraseCount(bullets: string[]) {
  const phraseCounts = new Map<string, number>();
  for (const bullet of bullets) {
    const words = normalize(bullet)
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word));
    const seenInBullet = new Set<string>();
    for (let index = 0; index <= words.length - 5; index += 1) {
      const phrase = words.slice(index, index + 5).join(" ");
      seenInBullet.add(phrase);
    }
    for (const phrase of seenInBullet) phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
  }
  return Array.from(phraseCounts.values()).filter((count) => count > 1).length;
}

const mainVerbHints = new Set([
  ...actionVerbs,
  "is",
  "are",
  "was",
  "were",
  "be",
  "being",
  "been",
  "build",
  "builds",
  "create",
  "creates",
  "design",
  "designs",
  "develop",
  "develops",
  "deliver",
  "delivers",
  "drive",
  "drives",
  "lead",
  "leads",
  "own",
  "owns",
  "support",
  "supports",
]);

const nounStackTerms = new Set([
  ...knownToolTerms.flatMap((term) => normalize(term).split(" ")),
  ...atsAnchorToolTerms.flatMap((term) => normalize(term).split(" ")),
  "access",
  "alert",
  "alerts",
  "analysis",
  "app",
  "application",
  "audit",
  "checks",
  "cloud",
  "control",
  "controls",
  "dashboard",
  "dashboards",
  "data",
  "detection",
  "detections",
  "evidence",
  "identity",
  "infrastructure",
  "pipeline",
  "pipelines",
  "risk",
  "security",
  "telemetry",
  "triage",
  "validation",
  "workflow",
  "workflows",
]);

function splitSentences(text: string) {
  return String(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasMainVerb(sentence: string) {
  const words = normalize(sentence).split(" ").filter(Boolean);
  return words.some((word) => mainVerbHints.has(word) || (word.length > 4 && /(ed|ing|izes?|ises?)$/.test(word) && !nounStackTerms.has(word)));
}

function hasLongNounStack(sentence: string, maxStack = 5) {
  const rawWords = String(sentence).split(/\s+/).filter(Boolean);
  let stack = 0;
  for (const rawWord of rawWords) {
    const clean = rawWord.replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#]+$/g, "");
    const normalized = normalize(clean);
    const hasComma = /[,;:]/.test(rawWord);
    const nounish =
      Boolean(clean) &&
      !stopWords.has(normalized) &&
      !actionVerbs.includes(normalized) &&
      (nounStackTerms.has(normalized) || /^[A-Z0-9+#]{2,}$/.test(clean) || /^[A-Z][a-z]+$/.test(clean));
    stack = nounish ? stack + 1 : 0;
    if (stack > maxStack) return true;
    if (hasComma) stack = 0;
  }
  return false;
}

function findRepeatedPhrases(bullets: string[], minWords = 4, minCount = 4) {
  const counts = new Map<string, number>();
  for (const bullet of bullets) {
    const words = normalize(bullet)
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word));
    const seen = new Set<string>();
    for (let index = 0; index <= words.length - minWords; index += 1) {
      const phrase = words.slice(index, index + minWords).join(" ");
      if (phrase.split(" ").some((word) => !genericAtsTerms.includes(word))) seen.add(phrase);
    }
    for (const phrase of seen) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minCount)
    .map(([phrase]) => phrase);
}

function linguisticCoherenceScore(bullets: string[]) {
  let issues = 0;
  const diagnostics: string[] = [];
  for (const bullet of bullets) {
    const sentences = splitSentences(bullet);
    const sentenceList = sentences.length ? sentences : [bullet];
    for (const sentence of sentenceList) {
      if (!hasMainVerb(sentence)) {
        issues += 1;
        diagnostics.push(`Fragment without a clear main verb: "${compactText(sentence, 90)}"`);
      }
      if (hasLongNounStack(sentence, 5)) {
        issues += 1;
        diagnostics.push(`Long noun stack detected: "${compactText(sentence, 90)}"`);
      }
    }
    if (!/[.!?]$/.test(bullet.trim()) || /\b(?:and|or|with|using|via|for|to|by|into|across|including|through|of)$/i.test(bullet.trim())) {
      issues += 1;
      diagnostics.push(`Bullet appears to end mid-clause: "${compactText(bullet, 90)}"`);
    }
  }
  const repeated = findRepeatedPhrases(bullets, 4, 4);
  issues += repeated.length;
  diagnostics.push(...repeated.map((phrase) => `Repeated phrase across 4+ bullets: "${phrase}"`));
  return { score: Math.max(0, 100 - issues * 10), diagnostics };
}

function numericValuesFromBullets(bullets: string[]) {
  return bullets.flatMap((bullet) =>
    (bullet.match(/\b\d+(?:\.\d+)?%?\+?/g) ?? [])
      .map((raw) => ({ raw, value: Number(raw.replace(/[%+]/g, "")), isPercent: raw.includes("%") }))
      .filter((item) => Number.isFinite(item.value) && !(item.value >= 1900 && item.value <= 2099)),
  );
}

function metricBelievabilityScore(bullets: string[]) {
  const metrics = numericValuesFromBullets(bullets);
  const diagnostics: string[] = [];
  if (!metrics.length) {
    return { score: 90, diagnostics: ["No numeric claims found; believability is neutral, but specificity may still suffer."] };
  }
  let score = 100;
  const roundMetrics = metrics.filter((metric) => metric.value % 5 === 0);
  if (metrics.length >= 3 && roundMetrics.length / metrics.length > 0.8) {
    score -= 25;
    diagnostics.push(`${roundMetrics.length}/${metrics.length} metrics are round multiples of 5 or 10.`);
  }
  const percentCounts = new Map<string, number>();
  for (const metric of metrics.filter((item) => item.isPercent)) {
    percentCounts.set(metric.raw, (percentCounts.get(metric.raw) ?? 0) + 1);
  }
  const repeatedPercents = Array.from(percentCounts.entries()).filter(([, count]) => count > 1);
  if (repeatedPercents.length) {
    score -= Math.min(40, repeatedPercents.reduce((sum, [, count]) => sum + (count - 1) * 15, 0));
    diagnostics.push(`Repeated percentage claims: ${repeatedPercents.map(([value, count]) => `${value} x${count}`).join(", ")}.`);
  }
  return { score: Math.max(0, score), diagnostics };
}

function hasNamedToolOrSystem(text: string) {
  const normalized = normalize(text);
  return atsAnchorToolTerms.some((term) => containsTerm(normalized, term)) || knownToolTerms.some((term) => containsTerm(normalized, term));
}

function hasNamedOutcome(text: string) {
  return /\b(?:false positives?|mttr|mttc|sla|coverage|detection accuracy|alert noise|triage time|case resolution|handoff|downtime|latency|cycle time|defects?|rework|retention|conversion|forecast accuracy|first-time fix|stockouts?)\b/i.test(
    text,
  );
}

function bulletSpecificityScore(bullets: string[]) {
  const specific = bullets.filter((bullet) => hasNamedToolOrSystem(bullet) || hasNumbers(bullet) || hasNamedOutcome(bullet)).length;
  return {
    score: bullets.length ? scoreFromRatio(specific / bullets.length) : 0,
    diagnostics: bullets.length && specific < bullets.length ? [`${bullets.length - specific}/${bullets.length} bullets lack a named tool, number, or concrete outcome.`] : [],
  };
}

function sameVerbRunCount(bullets: string[]) {
  let maxRun = 0;
  let currentVerb = "";
  let currentRun = 0;
  for (const bullet of bullets) {
    const verb = normalize(cleanResumeLine(bullet)).split(" ")[0] ?? "";
    if (verb && verb === currentVerb) currentRun += 1;
    else {
      currentVerb = verb;
      currentRun = verb ? 1 : 0;
    }
    maxRun = Math.max(maxRun, currentRun);
  }
  return maxRun;
}

function countRegexMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

function antiStuffingScore(resume: string, bullets: string[], anchors: string[]) {
  const diagnostics: string[] = [];
  let patterns = 0;
  const wordCount = countWords(resume) || 1;
  const anchorHits = anchors.reduce((sum, anchor) => sum + countTermOccurrences(resume, anchor), 0);
  if (anchors.length && anchorHits / wordCount > 1 / 12) {
    patterns += 1;
    diagnostics.push(`Anchor density is ${anchorHits}/${wordCount} words, above 1 per 12 words.`);
  }
  const acrossGeneric = countRegexMatches(resume, /\bacross \d+ (?:workstreams|deliverables|items|review paths|signal sources|control areas|data sources|workflows)\b/gi);
  if (acrossGeneric >= 3) {
    patterns += 1;
    diagnostics.push(`Templated "across N ..." phrasing appears ${acrossGeneric} times.`);
  }
  const applyingList = countRegexMatches(resume, /\bapplying\s+\w+(?:\s+\w+)?(?:,\s*\w+(?:\s+\w+)?){2,}/gi);
  if (applyingList >= 2) {
    patterns += 1;
    diagnostics.push(`Templated "applying comma-separated list" phrasing appears ${applyingList} times.`);
  }
  if (/AWS IAM, Kubernetes, identity telemetry, CI checks, and risk dashboards/i.test(resume)) {
    patterns += 1;
    diagnostics.push("Known stuffing template found: AWS IAM, Kubernetes, identity telemetry, CI checks, and risk dashboards.");
  }
  const verbRun = sameVerbRunCount(bullets);
  if (verbRun >= 3) {
    patterns += 1;
    diagnostics.push(`${verbRun} bullets in a row start with the same verb.`);
  }
  const awkwardAnchorInsertions = anchors.filter((anchor) => {
    const escaped = escapeRegExp(anchor);
    return new RegExp(`\\b(?:applying|using|around|with)\\s+(?:\\w+\\s+){0,3}${escaped}\\b`, "i").test(resume);
  });
  if (awkwardAnchorInsertions.length) {
    patterns += 1;
    diagnostics.push(`JD anchors appear in awkward inserted positions: ${awkwardAnchorInsertions.slice(0, 4).join(", ")}.`);
  }
  return { score: Math.max(0, 100 - patterns * 15), diagnostics };
}

function evidenceDensityScore(bullets: string[]) {
  const evidenceBullets = bullets.filter((bullet) => hasNamedToolOrSystem(bullet) || hasNumbers(bullet) || hasNamedOutcome(bullet)).length;
  return {
    score: bullets.length ? scoreFromRatio(evidenceBullets / bullets.length) : 0,
    diagnostics: bullets.length && evidenceBullets < bullets.length ? [`${bullets.length - evidenceBullets}/${bullets.length} bullets are soft evidence with no named tool, number, or outcome.`] : [],
  };
}

function detectHumanOrphanFragments(resume: string) {
  return normalizeResumeLines(resume)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^[,;]/.test(line)) return true;
      if (/^[.,;:!?-]+$/.test(line)) return true;
      if (line.length < 80 && /^[a-z]/.test(line) && /[.!?]$/.test(line)) return true;
      const words = normalize(line).split(" ").filter(Boolean);
      return line.length < 70 && words.length >= 2 && words.length <= 6 && !hasMainVerb(line) && !isProtectedHeading(line) && !line.includes("|");
    });
}

function orphanFragmentScore(resume: string) {
  const orphans = detectHumanOrphanFragments(resume);
  return {
    score: Math.max(0, 100 - orphans.length * 25),
    diagnostics: orphans.length ? [`${orphans.length} orphan or fragmentary visual lines detected: "${compactText(orphans[0], 90)}"`] : [],
  };
}

function humanQualityResult(resume: string, bullets: string[], anchors: string[]): HumanResult {
  const coherence = linguisticCoherenceScore(bullets);
  const specificity = bulletSpecificityScore(bullets);
  const antiStuffing = antiStuffingScore(resume, bullets, anchors);
  const evidence = evidenceDensityScore(bullets);
  const metrics = metricBelievabilityScore(bullets);
  const orphans = orphanFragmentScore(resume);
  const subscores: HumanSubscores = {
    coherence: coherence.score,
    specificity: specificity.score,
    antiStuffing: antiStuffing.score,
    evidence: evidence.score,
    metrics: metrics.score,
    orphans: orphans.score,
  };
  const score = Math.round(
    subscores.coherence * 0.3 +
      subscores.specificity * 0.2 +
      subscores.antiStuffing * 0.2 +
      subscores.evidence * 0.15 +
      subscores.metrics * 0.1 +
      subscores.orphans * 0.05,
  );
  const allDiagnostics = [
    ...coherence.diagnostics,
    ...specificity.diagnostics,
    ...antiStuffing.diagnostics,
    ...evidence.diagnostics,
    ...metrics.diagnostics,
    ...orphans.diagnostics,
  ];
  const band: HumanResult["band"] = score < 75 ? "risk" : score < 85 ? "acceptable" : "strong";
  return {
    score,
    band,
    subscores,
    diagnostics: band === "strong" ? [] : allDiagnostics.slice(0, band === "risk" ? 8 : 2),
  };
}

function humanQualityScore(resume: string, bullets: string[], anchors: string[] = []) {
  return humanQualityResult(resume, bullets, anchors).score;
}

function humanSubscoreLabel(label: keyof HumanSubscores) {
  const labels: Record<keyof HumanSubscores, string> = {
    coherence: "Coherence",
    specificity: "Specificity",
    antiStuffing: "Anti-Stuffing",
    evidence: "Evidence",
    metrics: "Metrics",
    orphans: "Orphans",
  };
  return labels[label];
}

function compactText(text: string, maxLength = 150) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}...` : clean;
}

function jdRequirementLines(jd: string) {
  const benefitWords = /\b(benefit|insurance|fsa|holiday|leave|401|parental|adoption|fertility|backup care|employee assistance|referral)\b/i;
  const seen = new Set<string>();
  return jd
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length >= 18 && line.length <= 170)
    .filter((line) => !benefitWords.test(line))
    .filter((line) => {
      const key = normalize(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function labelFromRequirement(line: string, profile: DomainProfile) {
  const directTerms = safeRewriteTerms(extractKeywords(line, profile), profile, 3);
  if (directTerms.length) return readableList(directTerms);
  return compactText(line, 82);
}

function explicitToolTerms(jd: string, profile: DomainProfile, jdKeywords: string[]) {
  const jdNorm = normalize(jd);
  const knownHits = knownToolTerms.filter((term) => containsTerm(jdNorm, term));
  const profileHits = profile.coreTerms.filter((term) => containsTerm(jdNorm, term));
  const keywordHits = jdKeywords.filter((term) => /[+#./-]|\d/.test(term) || knownToolTerms.some((known) => normalize(known) === normalize(term)));
  return unique([...knownHits, ...profileHits, ...keywordHits])
    .map((term) => naturalKeywordTerm(term, profile) || normalize(term))
    .filter(Boolean)
    .slice(0, 10);
}

function termsForEvidence(text: string, profile: DomainProfile) {
  return safeRewriteTerms(extractKeywords(text, profile), profile, 5);
}

function bestEvidenceLine(resumeLines: string[], terms: string[]) {
  let best = { line: "", hits: 0 };
  for (const line of resumeLines) {
    const normalizedLine = normalize(line);
    const hits = terms.filter((term) => containsTerm(normalizedLine, term)).length;
    if (hits > best.hits) best = { line, hits };
  }
  return best;
}

function buildTargetingSignals(resume: string, jd: string, profile: DomainProfile, jdKeywords: string[]): TargetingSignal[] {
  const resumeLines = resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24 && !isProtectedHeading(line));
  const requirementLines = jdRequirementLines(jd);
  const signals: TargetingSignal[] = [];
  const addSignal = (category: TargetingSignal["category"], label: string, terms: string[], fallbackEvidence = "No direct supporting line found yet.") => {
    const cleanTerms = safeRewriteTerms(terms, profile, 5);
    if (!label || !cleanTerms.length) return;
    const key = `${category}:${normalize(label)}`;
    if (signals.some((signal) => `${signal.category}:${normalize(signal.label)}` === key)) return;
    const best = bestEvidenceLine(resumeLines, cleanTerms);
    const status: TargetingSignal["status"] = best.hits >= Math.min(2, cleanTerms.length) ? "strong" : best.hits === 1 ? "partial" : "missing";
    signals.push({
      category,
      label: compactText(label, 72),
      status,
      evidence: best.line ? compactText(best.line) : fallbackEvidence,
      terms: cleanTerms,
    });
  };

  for (const tool of explicitToolTerms(jd, profile, jdKeywords).slice(0, 8)) {
    addSignal("Tools", displayKeywordTerm(tool), [tool]);
  }

  const jdNorm = normalize(jd);
  const categorySignals: Array<[TargetingSignal["category"], string, string[]]> = [
    ["Compliance", "Compliance and audit readiness", complianceTerms],
    ["Training", "Security training and documentation", trainingTerms],
    ["Cloud", "Cloud and DevSecOps ownership", cloudTerms],
    ["Ownership", "First security hire ownership", ownershipTerms],
  ];
  for (const [category, label, terms] of categorySignals) {
    const hits = terms.filter((term) => containsTerm(jdNorm, term));
    if (hits.length) addSignal(category, label, hits.slice(0, 5));
  }

  for (const line of requirementLines) {
    const lower = normalize(line);
    const terms = termsForEvidence(line, profile);
    if (!terms.length) continue;
    if (complianceTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Compliance", labelFromRequirement(line, profile), terms);
    } else if (trainingTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Training", labelFromRequirement(line, profile), terms);
    } else if (cloudTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Cloud", labelFromRequirement(line, profile), terms);
    } else if (ownershipTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Ownership", labelFromRequirement(line, profile), terms);
    } else if (automationTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Automation", labelFromRequirement(line, profile), terms);
    } else if (documentationTerms.some((term) => containsTerm(lower, term))) {
      addSignal("Documentation", labelFromRequirement(line, profile), terms);
    } else if (responsibilityVerbs.some((verb) => containsTerm(lower, verb))) {
      addSignal("Responsibilities", labelFromRequirement(line, profile), terms);
    }
    if (signals.length >= 18) break;
  }

  if (signals.length < 6) {
    for (const keyword of jdKeywords.slice(0, 12)) {
      addSignal("Responsibilities", displayKeywordTerm(keyword), [keyword]);
      if (signals.length >= 10) break;
    }
  }

  return signals.slice(0, 18);
}

function targetingScore(signals: TargetingSignal[]) {
  if (!signals.length) return 50;
  const total = signals.reduce((sum, signal) => sum + (signal.status === "strong" ? 1 : signal.status === "partial" ? 0.55 : 0), 0);
  return Math.round((total / signals.length) * 100);
}

function targetRoleFromJd(jd: string, profile: DomainProfile) {
  const firstLine = jd
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^(?:job title|title|role)\s*:\s*/i, "").trim())
    .find((line) => line.length >= 4 && line.length <= 110 && !/^(requirements|qualifications|benefits|responsibilities)$/i.test(line));
  return firstLine ? compactText(firstLine, 90) : profile.roles[0] ?? profile.name;
}

function statusFromScore(score: number): ProofPillar["status"] {
  if (score >= 80) return "strong";
  if (score >= 45) return "partial";
  return "missing";
}

function scoreFromSignalGroup(signals: TargetingSignal[]) {
  if (!signals.length) return 70;
  const total = signals.reduce((sum, signal) => sum + (signal.status === "strong" ? 1 : signal.status === "partial" ? 0.55 : 0), 0);
  return Math.round((total / signals.length) * 100);
}

function scoreTermsAgainstResume(resumeLines: string[], terms: string[], fallbackScore = 50) {
  const cleanTerms = terms.filter(Boolean);
  if (!cleanTerms.length) {
    return {
      score: fallbackScore,
      proof: "No direct supporting line found yet.",
    };
  }
  const best = bestEvidenceLine(resumeLines, cleanTerms);
  const ratio = best.hits / cleanTerms.length;
  return {
    score: scoreFromRatio(Math.min(1, ratio)),
    proof: best.line ? compactText(best.line) : "No direct supporting line found yet.",
  };
}

function buildRoleBlueprint(
  resume: string,
  jd: string,
  profile: DomainProfile,
  jdKeywords: string[],
  targetingSignals: TargetingSignal[],
  bullets: string[],
): RoleBlueprint {
  const resumeLines = resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24 && !isProtectedHeading(line));
  const targetRole = targetRoleFromJd(jd, profile);
  const jdNorm = normalize(jd);
  const toolTerms = explicitToolTerms(jd, profile, jdKeywords).slice(0, 6);
  const responsibilitySignals = targetingSignals.filter((signal) =>
    ["Responsibilities", "Automation", "Cloud", "Ownership"].includes(signal.category),
  );
  const supportSignals = targetingSignals.filter((signal) => ["Documentation", "Compliance", "Training"].includes(signal.category));
  const responsibilityTerms = safeRewriteTerms(
    unique([...responsibilitySignals.flatMap((signal) => signal.terms), ...jdKeywords]).slice(0, 18),
    profile,
    8,
  );
  const builderTerms = safeRewriteTerms(
    unique(
      [
        ...jdKeywords.filter((term) => /build|own|autom|pipeline|script|workflow|develop|deliver|ship|design|implement|strategy/i.test(term)),
        ...ownershipTerms.filter((term) => containsTerm(jdNorm, term)),
        ...automationTerms.filter((term) => containsTerm(jdNorm, term)),
      ],
    ),
    profile,
    6,
  );
  const supportTerms = safeRewriteTerms(unique(supportSignals.flatMap((signal) => signal.terms)), profile, 6);
  const metricStats = metricLeadStats(bullets);
  const quantified = bullets.filter(hasNumbers).length;
  const metricScore = bullets.length
    ? Math.round(scoreFromRatio(quantified / bullets.length) * 0.55 + scoreFromRatio(metricStats.metricLeadCount / Math.max(1, metricStats.metricLeadTotal)) * 0.45)
    : 40;

  const toolScore = toolTerms.length ? scoreFromSignalGroup(targetingSignals.filter((signal) => signal.category === "Tools")) : 75;
  const responsibilityScore = scoreFromSignalGroup(responsibilitySignals);
  const supportScore = supportTerms.length ? scoreFromSignalGroup(supportSignals) : 80;
  const builderEvidence = scoreTermsAgainstResume(resumeLines, builderTerms.length ? builderTerms : profile.coreTerms.slice(0, 4), 65);

  const makePillar = (label: string, score: number, jdNeed: string, terms: string[], proofOverride?: string): ProofPillar => {
    const cleanTerms = safeRewriteTerms(terms, profile, 6);
    const proof = proofOverride ?? scoreTermsAgainstResume(resumeLines, cleanTerms, score).proof;
    return {
      label,
      score,
      status: statusFromScore(score),
      jdNeed,
      resumeProof: proof,
      terms: cleanTerms,
    };
  };

  const proofPillars = [
    makePillar(
      "Direct Tool Match",
      toolScore,
      toolTerms.length ? `Show direct hits on ${readableList(toolTerms.slice(0, 5))}.` : `Show the core tools and systems for ${targetRole}.`,
      toolTerms.length ? toolTerms : profile.coreTerms.slice(0, 5),
    ),
    makePillar(
      "Core Responsibility Match",
      responsibilityScore,
      "Mirror the JD's actual day-to-day responsibilities with proof, not just keywords.",
      responsibilityTerms,
    ),
    makePillar(
      "Operating Rhythm And Metrics",
      metricScore,
      "Make the resume feel real through scope, cadence, volumes, outcomes, and before/after movement.",
      ["metrics", "cadence", "scope", "outcomes"],
      `${metricStats.metricLeadCount}/${metricStats.metricLeadTotal} impact lines lead with metrics; ${quantified}/${bullets.length || 1} include numbers.`,
    ),
    makePillar(
      "Builder And Ownership Signal",
      builderEvidence.score,
      "Show that the candidate can build, own, automate, improve, or ship the work the role needs.",
      builderTerms.length ? builderTerms : profile.coreTerms.slice(0, 4),
      builderEvidence.proof,
    ),
    makePillar(
      "Documentation And Stakeholder Fit",
      supportScore,
      "Cover documentation, training, compliance, stakeholder, or handoff work when the JD asks for it.",
      supportTerms.length ? supportTerms : ["documentation", "stakeholder", "handoff"],
    ),
  ];

  const weakPillars = proofPillars.filter((pillar) => pillar.status !== "strong");
  const strongPillars = proofPillars.filter((pillar) => pillar.status === "strong");
  const atsFocus = unique([
    ...weakPillars.flatMap((pillar) => pillar.terms),
    ...jdKeywords,
  ]).slice(0, 18);
  const humanWarnings = [
    ...(detectOrphanFragments(resume).length ? ["Fix dangling/orphan bullet fragments before optimizing keywords."] : []),
    ...(repeatedLongPhraseCount(bullets) ? ["Remove repeated stock phrases so the resume does not read like AI output."] : []),
    ...(metricScore < 75 ? ["Move real scope, cadence, or outcome metrics into the first half of bullets."] : []),
    ...(weakPillars.length ? [`Close weak proof pillars: ${weakPillars.map((pillar) => pillar.label).join(", ")}.`] : []),
  ];

  return {
    targetRole,
    roleThesis:
      strongPillars.length
        ? `Position this resume for ${targetRole} through ${strongPillars.map((pillar) => pillar.label.toLowerCase()).join(", ")} while tightening ${weakPillars.map((pillar) => pillar.label.toLowerCase()).join(", ") || "human readability"}.`
        : `Rebuild the resume narrative around ${targetRole} by proving tools, responsibilities, operating rhythm, ownership, and documentation fit.`,
    proofPillars,
    atsFocus,
    rewriteStrategy: [
      `Lead the summary with the ${targetRole} fit and the strongest 2-3 proof pillars.`,
      "Map each experience/project line to one clear JD responsibility, tool set, or outcome.",
      "Use exact JD terms only where the line proves them naturally; avoid copied fragments and keyword piles.",
      "Put scope, cadence, volume, or result near the front of bullets so the work feels real.",
      "Prioritize weak proof pillars before adding lower-value keywords.",
    ],
    humanWarnings: humanWarnings.length ? humanWarnings : ["Current wording has no major human-review red flags, but still keep every line concrete and proof-led."],
  };
}

function qualityGates({
  atsScore,
  humanScore,
  evidenceScore,
  roleFitScore,
}: {
  atsScore: number;
  humanScore: number;
  evidenceScore: number;
  roleFitScore: number;
}): QualityGate[] {
  return [
    {
      label: "ATS Gate",
      score: atsScore,
      target: ATS_GATE_SCORE,
      passed: atsScore === 100,
      detail: "All six deterministic ATS checks must pass.",
    },
    {
      label: "Human Gate",
      score: humanScore,
      target: HUMAN_GATE_SCORE,
      passed: humanScore >= HUMAN_GATE_SCORE,
      detail: "Recruiter-readable bullets without stuffing.",
    },
    {
      label: "Evidence Gate",
      score: evidenceScore,
      target: EVIDENCE_GATE_SCORE,
      passed: evidenceScore >= EVIDENCE_GATE_SCORE,
      detail: "JD responsibilities mapped to resume proof.",
    },
    {
      label: "Role Fit Gate",
      score: roleFitScore,
      target: ROLE_FIT_GATE_SCORE,
      passed: roleFitScore >= ROLE_FIT_GATE_SCORE,
      detail: "Human-style role blueprint: tools, duties, metrics, ownership, and documentation.",
    },
  ];
}

function passesQualityGates(analysis: Analysis) {
  return analysis.gates.length > 0 && analysis.gates.every((gate) => gate.passed);
}

function analyzeBullet(bullet: string, missingKeywords: string[], repeatedVerbs: Array<[string, number]>, profile: DomainProfile): BulletReview {
  const normalized = normalize(bullet);
  const words = countWords(bullet);
  const firstWord = bullet.split(/\s+/)[0]?.toLowerCase() ?? "";
  const repeated = repeatedVerbs.some(([verb]) => verb === firstWord);
  const keywordHits = unique([...profileTerms(profile), ...missingKeywords]).filter((term) => containsTerm(normalized, term));
  const weakHits = weakPhrases.filter((phrase) => containsTerm(normalized, phrase));
  const buzzHits = buzzwords.filter((word) => containsTerm(normalized, word));
  const qualityRisk = sentenceQualityRisk(bullet);
  const fixes: string[] = [];
  let score = 20;

  if (actionVerbs.includes(firstWord)) score += 18;
  else fixes.push("Start with a stronger action verb.");

  if (hasNumbers(bullet)) score += 24;
  else fixes.push("Add a real metric, scope, frequency, or before/after result.");

  if (words >= 12 && words <= 34) score += 18;
  else fixes.push(words < 12 ? "Add scope and outcome detail." : "Tighten this bullet to one clean outcome.");

  if (keywordHits.length >= 3) score += 20;
  else fixes.push(`Work in exact JD terms such as ${missingKeywords.slice(0, 3).join(", ") || "the role's core tools"}.`);

  if (!repeated) score += 10;
  else fixes.push(`Replace repeated verb "${sentenceCase(firstWord)}" with a fresher action verb.`);

  if (!weakHits.length && !buzzHits.length) score += 10;
  else fixes.push("Remove weak phrases or generic buzzwords.");

  if (qualityRisk >= 25) {
    score -= Math.min(35, qualityRisk);
    fixes.push("Remove AI-looking keyword stuffing and keep one concrete action, system, and result.");
  }

  score = Math.max(0, Math.min(100, score));
  if (fixes.length === 1) score = Math.min(score, 86);
  if (fixes.length >= 2) score = Math.min(score, 72);
  const safeTerms = safeRewriteTerms([...missingKeywords, ...keywordHits], profile, 3);
  const targetKeyword = safeTerms[0] ?? profile.categories[0]?.toLowerCase() ?? "role priority";
  const rewriteFocus = readableList(safeTerms) || displayKeywordTerm(targetKeyword);
  const rewrite = `Keep the original facts, then reframe this line around ${rewriteFocus}: action first, one concrete system or object, one real metric or outcome, no copied JD fragments.`;

  return {
    text: bullet,
    score,
    verdict: score >= 90 ? "Strong" : score >= 75 ? "Good, tighten it" : score >= 60 ? "Needs stronger evidence" : "Rewrite recommended",
    fixes: fixes.slice(0, 4),
    rewrite,
  };
}

function keywordPhrase(terms: string[], fallback: string) {
  return terms.find((term) => term.length > 4) ?? fallback;
}

function rewriteBulletForDraft(original: string, missingKeywords: string[], index: number, profile: DomainProfile) {
  const first = original.split(/\s+/)[0] ?? "Engineered";
  const verb = actionVerbs.includes(first.toLowerCase()) ? sentenceCase(first) : "Engineered";
  const safeTerms = safeRewriteTerms(missingKeywords, profile, 3);
  const primary = safeTerms[0] ?? profile.categories[0]?.toLowerCase() ?? "role priority";
  const secondary = safeTerms[1] ?? profile.coreTerms[0] ?? "quality";
  const tertiary = safeTerms[2] ?? profile.coreTerms[1] ?? "validation";
  const readableTerms = readableList([primary, secondary, tertiary]);
  const system = profile.systems[0];

  if (/pipeline|automation|workflow/i.test(original)) {
    return `${verb} automation workflow with ${readableTerms}, connecting ${system} to ${profile.outcomes[0]}.`;
  }

  if (/detection|alert|anomal|analysis|test|quality|validation/i.test(original)) {
    return `${verb} detection and validation work with ${readableTerms}, mapping concrete findings to ${profile.outcomes[1] ?? profile.outcomes[0]}.`;
  }

  if (/project|lab|portfolio|prototype|campaign|case|model|design/i.test(original)) {
    return `${verb} project evidence around ${readableTerms}, connecting ${system} to a working, reviewable outcome.`;
  }

  const scopedMetric = index % 2 === 0 ? "5 control areas" : "4 reusable artifacts";
  return `${verb} ${displayKeywordTerm(primary)} capability across ${scopedMetric}, using ${readableList([secondary, tertiary])} to ${profile.outcomes[2] ?? profile.outcomes[0]}.`;
}

function injectSummaryKeywords(resume: string, missingKeywords: string[]) {
  const profile = detectDomain(resume);
  const topTerms = safeRewriteTerms(missingKeywords, profile, 5);
  if (!topTerms.length) return { text: resume, changed: false };
  const sentence = ` Core alignment includes ${readableList(topTerms)}.`;
  const sectionPattern =
    /(SUMMARY\s*\n)([\s\S]*?)(\n\s*(?:PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|SKILLS|PROJECTS|EDUCATION)\b)/i;
  const match = resume.match(sectionPattern);
  if (!match) return { text: resume, changed: false };
  const cleanSummary = match[2]
    .replace(/\s*Targeted alignment:[^.]*\./gi, "")
    .replace(/\s*Core alignment includes [^.]*\./gi, "")
    .trim();
  if (topTerms.every((term) => containsTerm(normalize(cleanSummary), term))) {
    return {
      text: resume.replace(sectionPattern, `${match[1]}${cleanSummary}${match[3]}`),
      changed: false,
    };
  }
  return {
    text: resume.replace(sectionPattern, `${match[1]}${cleanSummary}${sentence}${match[3]}`),
    changed: true,
  };
}

function createTailoredDraft(resume: string, jd: string, analysis: Analysis): TailoredDraft {
  const changes: string[] = [];
  const summaryResult = injectSummaryKeywords(resume, analysis.missingKeywords);
  let draftLines = normalizeResumeLines(summaryResult.text);
  if (summaryResult.changed) {
    changes.push(`Strengthened summary with top JD terms: ${analysis.missingKeywords.slice(0, 8).join(", ")}.`);
  }
  const editableLines = editableResumeLines(draftLines);
  const weakReviews = analysis.bulletReviews.filter((review) => review.score < 90).slice(0, 6);
  weakReviews.forEach((review, index) => {
    const replacement = rewriteBulletForDraft(review.text, analysis.missingKeywords, index, analysis.domain);
    const lineIndex = draftLines.findIndex((line, candidateIndex) => {
      const cleanLine = line.replace(/^(?:\u2022|[-*])\s*/, "").trim();
      return editableLines.has(candidateIndex) && cleanLine === review.text;
    });
    if (lineIndex >= 0) {
      const bulletPrefix = draftLines[lineIndex].match(/^(\s*(?:\u2022|[-*])\s*)/)?.[1] ?? "";
      draftLines[lineIndex] = `${bulletPrefix}${replacement}`;
      changes.push(`Rewrote experience/project bullet ${analysis.bulletReviews.indexOf(review) + 1} for stronger JD keyword alignment.`);
    }
  });

  if (!changes.length && analysis.missingKeywords.length) {
    changes.push("No safe summary, experience, or project content line was available for local rewrite without changing resume structure.");
  }

  const draft = draftLines.join("\n");
  const draftScore = gradeAnalysis(draft, jd).overall;
  return {
    text: draft,
    score: draftScore,
    previousScore: analysis.overall,
    changes,
  };
}

function priorityRewriteTerms(analysis: Analysis, jd: string) {
  const profileWordSet = new Set(profileTerms(analysis.domain).flatMap((term) => normalize(term).split(" ")));
  const jdKeywords = extractKeywords(jd, analysis.domain);
  const blueprintTerms = analysis.roleBlueprint.proofPillars
    .filter((pillar) => pillar.status !== "strong")
    .flatMap((pillar) => pillar.terms);
  return unique([...blueprintTerms, ...analysis.roleBlueprint.atsFocus, ...analysis.missingKeywords, ...jdKeywords])
    .map((term) => naturalKeywordTerm(term, analysis.domain))
    .filter(Boolean)
    .sort((a, b) => {
      const aNorm = normalize(a);
      const bNorm = normalize(b);
      const aMissing = analysis.missingKeywords.some((term) => normalize(term) === aNorm) ? 50 : 0;
      const bMissing = analysis.missingKeywords.some((term) => normalize(term) === bNorm) ? 50 : 0;
      const aPhrase = aNorm.includes(" ") ? 12 : 0;
      const bPhrase = bNorm.includes(" ") ? 12 : 0;
      return bMissing + bPhrase + keywordValueScore(b, profileWordSet) - (aMissing + aPhrase + keywordValueScore(a, profileWordSet));
    });
}

function supportedRewriteTermsForLine(line: string, lineNumber: number, analysis: Analysis, jd: string) {
  const lineNorm = normalize(line);
  const role = analysis.evidenceGraph.roles.find((item) => lineNumber >= item.startLine && lineNumber <= item.endLine);
  const allowed = unique([
    ...(role?.allowedTools ?? []),
    ...(role?.allowedObjects ?? []),
    ...(role?.allowedActions ?? []),
    ...(role?.allowedOutcomes ?? []),
    ...analysis.evidenceGraph.frameworks,
    ...analysis.evidenceGraph.toolsMentioned.filter((term) => containsTerm(lineNorm, term)),
  ]).map(normalize);
  return priorityRewriteTerms(analysis, jd).filter((term) => {
    const normalizedTerm = normalize(term);
    return containsTerm(lineNorm, normalizedTerm) || allowed.some((allowedTerm) => allowedTerm === normalizedTerm || containsTerm(allowedTerm, normalizedTerm));
  });
}

function fitGeneratedLineToOriginal(originalLine: string, candidateLine: string) {
  const limit = Math.max(36, originalLine.trimEnd().length + 3);
  if (candidateLine.trimEnd().length <= limit) return candidateLine;

  const prefix = candidateLine.match(/^(\s*(?:\u2022|[-*])\s*)/)?.[1] ?? "";
  let clean = candidateLine.replace(/^(?:\u2022|[-*])\s*/, "").trim();
  const tighteningPairs: Array<[RegExp, string]> = [
    [/\s+with evidence-backed execution/gi, ""],
    [/\s+with concrete findings/gi, ""],
    [/\s+reusable\s+/gi, " "],
    [/\s+stakeholder-ready\s+/gi, " "],
    [/\s+role-specific\s+/gi, " "],
    [/\s+measurable\s+/gi, " "],
    [/\s+concrete\s+/gi, " "],
    [/\s+validation\s+layers/gi, " checks"],
    [/\s+signal\s+sources/gi, " sources"],
    [/\s+review\s+paths/gi, " reviews"],
    [/\s+workflows/gi, " flows"],
  ];
  for (const [pattern, replacement] of tighteningPairs) {
    clean = clean.replace(pattern, replacement).replace(/\s+/g, " ").trim();
    const tightened = `${prefix}${clean}`;
    if (tightened.length <= limit) return tightened;
  }

  return originalLine;
}

function rewriteLineWithTerms(line: string, terms: string[], profile: DomainProfile, slot: number) {
  const prefix = line.match(/^(\s*(?:\u2022|[-*])\s*)/)?.[1] ?? "";
  const clean = line.replace(/^(?:\u2022|[-*])\s*/, "").trim();
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  const verbs = ["engineered", "designed", "validated", "improved", "coordinated", "delivered", "documented", "tested"];
  const safeTerms = safeRewriteTerms(terms, profile, 3);
  if (!safeTerms.length) return line;
  const termText = readableList(safeTerms);
  const hasActionVerb = actionVerbs.includes(firstWord);
  const verb = sentenceCase(hasActionVerb ? firstWord : verbs[slot % verbs.length]);
  const category = (profile.categories[slot % Math.max(1, profile.categories.length)] ?? "role").toLowerCase();
  const system = profile.systems[0] ?? "role-specific systems, process evidence, and stakeholder workflows";
  const outcome = profile.outcomes[slot % Math.max(1, profile.outcomes.length)] ?? "improve measurable outcomes";
  const isFragment = isLikelyOrphanFragmentLine(line, slot + 1);

  if (isFragment) {
    return line;
  }

  if (!hasActionVerb) {
    const summaryBase = clean.replace(/\s*Core alignment includes [^.]*\./gi, "").replace(/\.$/, "");
    return fitGeneratedLineToOriginal(
      line,
      `${summaryBase}, with hands-on emphasis on ${termText} through ${displayKeywordTerm(profile.coreTerms[0] ?? category)} work.`,
    );
  }

  if (/pipeline|automation|workflow|script|tool/i.test(clean)) {
    return fitGeneratedLineToOriginal(line, `${prefix}${verb} automation work using ${termText} and ${system} to ${outcome}.`);
  }

  if (/detection|alert|risk|review|validation|analysis|model|test/i.test(clean)) {
    return fitGeneratedLineToOriginal(
      line,
      `${prefix}${verb} ${category} analysis using ${termText} to prioritize findings and ${outcome}.`,
    );
  }

  return fitGeneratedLineToOriginal(line, `${prefix}${verb} ${category} work using ${termText} to support ${outcome}.`);
}

function optimizeResumeToTarget(resume: string, jd: string, targetScore: number) {
  let bestText = resume;
  let bestAnalysis = gradeAnalysis(resume, jd);
  const changes: string[] = [];

  for (const termsPerLine of [2, 3]) {
    if (bestAnalysis.overall >= targetScore) break;
    const lines = normalizeResumeLines(bestText);
    const editable = Array.from(editableResumeLines(lines)).filter((index) => lines[index]?.trim());
    if (!editable.length) {
      changes.push("No editable summary, experience, or project lines were available for the local target pass.");
      break;
    }

    editable.forEach((lineIndex, slot) => {
      const lineTerms = supportedRewriteTermsForLine(lines[lineIndex] ?? "", lineIndex + 1, bestAnalysis, jd).slice(0, termsPerLine);
      if (lineTerms.length) {
        lines[lineIndex] = rewriteLineWithTerms(lines[lineIndex], lineTerms, bestAnalysis.domain, slot);
      }
    });

    const candidateText = lines.join("\n");
    const candidateAnalysis = gradeAnalysis(candidateText, jd);
    const candidateHumanScore = candidateAnalysis.cards.find((card) => card.label === "Human Screen")?.score ?? 100;
    if (candidateAnalysis.overall > bestAnalysis.overall && candidateHumanScore >= 78) {
      const covered = bestAnalysis.missingKeywords.length - candidateAnalysis.missingKeywords.length;
      bestText = candidateText;
      bestAnalysis = candidateAnalysis;
      changes.push(`Human-safe target pass added ${Math.max(0, covered)} JD terms without changing layout or packing keyword lists.`);
    } else {
      break;
    }
  }

  return {
    text: bestText,
    analysis: bestAnalysis,
    changes,
  };
}

function cleanTargetTerms(terms: string[], profile: DomainProfile, maxTerms = 12) {
  return unique(terms)
    .map((term) => naturalKeywordTerm(term, profile))
    .filter(Boolean)
    .filter((term) => {
      const words = normalize(term).split(" ");
      return !(words.length === 1 && weakSingleKeywordTerms.has(words[0]));
    })
    .slice(0, maxTerms);
}

function buildMagicBullets(analysis: Analysis, jd: string): MagicBullet[] {
  const profile = analysis.domain;
  const targets = cleanTargetTerms(unique([...analysis.roleBlueprint.atsFocus, ...analysis.missingKeywords, ...extractKeywords(jd, profile)]), profile, 12);
  const rankedRoles = [...analysis.evidenceGraph.roles]
    .map((role) => ({
      role,
      hits: role.allowedTools.filter((tool) => targets.some((term) => normalize(term) === normalize(tool))).length + role.allowedObjects.filter((object) => targets.some((term) => containsTerm(normalize(object), term))).length,
    }))
    .sort((a, b) => b.hits - a.hits || a.role.startLine - b.role.startLine)
    .map((item) => item.role);

  const sourceRoles = rankedRoles.length ? rankedRoles.slice(0, 4) : analysis.evidenceGraph.roles.slice(0, 4);
  if (!sourceRoles.length) {
    return [
      {
        label: "Evidence First",
        keywords: targets.slice(0, 4),
        bullet: `Use existing resume proof for ${readableList(targets.slice(0, 3)) || profile.name}; avoid adding JD terms that are not already supported by the resume.`,
      },
    ];
  }

  return sourceRoles.map((role, index) => {
    const roleTargets = targets.filter(
      (term) =>
        role.allowedTools.some((tool) => normalize(tool) === normalize(term)) ||
        role.allowedObjects.some((object) => containsTerm(normalize(object), term)) ||
        role.allowedActions.some((action) => containsTerm(normalize(action), term)),
    );
    const tools = role.allowedTools.filter((tool) => roleTargets.some((term) => normalize(term) === normalize(tool))).slice(0, 3);
    const fallbackTools = role.allowedTools.slice(0, 2);
    const metric = role.allowedMetrics[0];
    const object = role.allowedObjects[0] || profile.categories[index % Math.max(1, profile.categories.length)] || "existing role evidence";
    const anchorText = readableList((roleTargets.length ? roleTargets : targets).slice(0, 3));
    const toolText = readableList((tools.length ? tools : fallbackTools).slice(0, 3));
    const metricText = metric ? ` Keep the existing ${metric} metric.` : " Use only scope already present in that role.";
    return {
      label: `${role.title}`.slice(0, 40),
      keywords: unique([...(roleTargets.length ? roleTargets : targets).slice(0, 4), ...tools]).slice(0, 6),
      bullet: `Reframe ${role.title} evidence around ${displayKeywordTerm(object)}${toolText ? ` using ${toolText}` : ""} to match ${anchorText || profile.name}.${metricText}`,
      rationale: `Uses only evidence from lines ${role.startLine}-${role.endLine}; do not borrow tools or metrics from another role.`,
    };
  });
}

function selectSampleBullets(analysis: Analysis, jd: string) {
  const targetText = normalize([...analysis.matchedKeywords, ...analysis.missingKeywords, jd].join(" "));
  return sampleBulletBank
    .map((sample) => ({
      ...sample,
      relevance: sample.tags.reduce((score, tag) => score + (containsTerm(targetText, tag) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.relevance - a.relevance || a.bullet.length - b.bullet.length)
    .slice(0, 8);
}

function buildProFeatureMap(analysis: Analysis, savedScans: SavedScan[]) {
  const lineReviewScore = analysis.bulletReviews.length
    ? Math.round(analysis.bulletReviews.reduce((sum, review) => sum + review.score, 0) / analysis.bulletReviews.length)
    : 40;
  const keywordCoverage = analysis.cards.find((card) => card.label === "JD Match")?.score ?? 0;

  return [
    {
      title: "Full Resume Review",
      detail: `${analysis.issues.length} prioritized findings, ${analysis.proChecks.length} advanced checks`,
      score: analysis.overall,
    },
    {
      title: "Line-by-Line Review",
      detail: `${analysis.bulletReviews.length} bullets scored with rewrite patterns`,
      score: lineReviewScore,
    },
    {
      title: "Resume/JD Targeting",
      detail: `${analysis.matchedKeywords.length} matched, ${analysis.missingKeywords.length} missing keywords`,
      score: keywordCoverage,
    },
    {
      title: "Sample Bullet Bank",
      detail: `${sampleBulletBank.length} generated cross-domain patterns`,
      score: 92,
    },
    {
      title: "ATS Templates",
      detail: `${templateOptions.length} ATS-safe template tracks mapped`,
      score: 90,
    },
    {
      title: "Grounded Rewrite Prompt",
      detail: `${analysis.domain.name} rewrite guidance generated from JD gaps`,
      score: analysis.missingKeywords.length ? 88 : 96,
    },
    {
      title: "Unlimited Local Scans",
      detail: `${savedScans.length} saved locally, no upload limit`,
      score: 100,
    },
  ];
}

function gradeAnalysis(resume: string, jd: string): Analysis {
  const resumeNorm = normalize(resume);
  const domain = detectDomain(`${jd}\n${resume}`);
  const evidenceGraph = buildEvidenceGraph(resume, domain);
  const jdKeywords = extractKeywords(jd, domain);
  const matchedKeywords = jdKeywords.filter((term) => containsTerm(resumeNorm, term));
  const missingKeywords = jdKeywords.filter((term) => !containsTerm(resumeNorm, term));
  const keywordScore = scoreFromRatio(matchedKeywords.length / Math.max(1, jdKeywords.length));
  const ats = runDeterministicAtsChecks(resume, jd);

  const bullets = extractBullets(resume);
  const orphanFragments = detectOrphanFragments(resume);
  const metricLead = metricLeadStats(bullets);
  const quantifiedCount = bullets.filter(hasNumbers).length;
  const quantifiedRatio = quantifiedCount / Math.max(1, bullets.length);
  const impactScore = scoreFromRatio(Math.min(1, quantifiedRatio / 0.75));

  const starts = bullets.map((bullet) => bullet.split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const verbCounts = starts.reduce<Record<string, number>>((acc, verb) => {
    acc[verb] = (acc[verb] ?? 0) + 1;
    return acc;
  }, {});
  const repeatedVerbs = Object.entries(verbCounts)
    .filter(([, count]) => count > 2)
    .sort((a, b) => b[1] - a[1]);
  const repetitionPenalty = repeatedVerbs.reduce((sum, [, count]) => sum + (count - 2) * 8, 0);
  const wordChoiceScore = Math.max(0, 100 - repetitionPenalty);

  const atsScore = ats.passed ? 100 : 0;

  const roleDepthScore = bullets.length >= 16 ? 100 : bullets.length >= 10 ? 88 : bullets.length >= 6 ? 78 : bullets.length >= 4 ? 68 : 45;
  const emailFound = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(resume);
  const phoneFound = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.test(resume);
  const contactScore = emailFound && phoneFound ? 100 : emailFound || phoneFound ? 70 : 30;
  const dateMatches = resume.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/gi) ?? [];
  const dateScore = dateMatches.length >= 3 ? 100 : dateMatches.length >= 2 ? 82 : 58;
  const weakPhraseHits = weakPhrases.filter((phrase) => containsTerm(resumeNorm, phrase));
  const buzzwordHits = buzzwords.filter((word) => containsTerm(resumeNorm, word));
  const pronounHits = resume.match(/\b(I|me|my|mine|we|our)\b/g) ?? [];
  const languageScore = Math.max(0, 100 - weakPhraseHits.length * 12 - buzzwordHits.length * 8 - pronounHits.length * 6);
  const bulletLengthScore = bullets.length
    ? scoreFromRatio(
        bullets.filter((bullet) => {
          const words = bullet.split(/\s+/).length;
          return words >= 12 && words <= 34;
        }).length / bullets.length,
      )
    : 40;
  const lineHygieneScore = Math.max(0, 100 - orphanFragments.length * 35);
  const metricLeadScore = scoreFromRatio(metricLead.metricLeadCount / Math.max(1, metricLead.metricLeadTotal));
  const firstJdLine = jd.split(/\n+/).find((line) => line.trim().length > 8) ?? "";
  const titleWords = normalize(firstJdLine)
    .split(" ")
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .slice(0, 8);
  const titleMatchHits = titleWords.filter((word) => containsTerm(resumeNorm, word)).length;
  const titleMatchScore = titleWords.length ? scoreFromRatio(titleMatchHits / titleWords.length) : 80;
  const human = humanQualityResult(resume, bullets, ats.anchors);
  const humanScore = human.score;
  const targetingSignals = buildTargetingSignals(resume, jd, domain, jdKeywords);
  const evidenceScore = targetingScore(targetingSignals);
  const roleBlueprint = buildRoleBlueprint(resume, jd, domain, jdKeywords, targetingSignals, bullets);
  const roleFitScore = roleBlueprint.proofPillars.length
    ? Math.round(roleBlueprint.proofPillars.reduce((sum, pillar) => sum + pillar.score, 0) / roleBlueprint.proofPillars.length)
    : 50;
  const gates = qualityGates({ atsScore, humanScore, evidenceScore, roleFitScore });
  const overall = Math.round(
    keywordScore * 0.25 +
      impactScore * 0.15 +
      atsScore * 0.13 +
      wordChoiceScore * 0.06 +
      roleDepthScore * 0.05 +
      contactScore * 0.02 +
      dateScore * 0.01 +
      languageScore * 0.04 +
      titleMatchScore * 0.05 +
      humanScore * 0.1 +
      evidenceScore * 0.08 +
      roleFitScore * 0.06,
  );
  const bulletReviews = bullets.map((bullet) => analyzeBullet(bullet, missingKeywords, repeatedVerbs, domain));
  const unquantified = bullets.length - quantifiedCount;
  const projectedLift =
    Math.min(18, Math.ceil(missingKeywords.length / 4) * 2) +
    Math.min(12, unquantified * 3) +
    Math.min(8, repeatedVerbs.length * 4) +
    (contactScore < 100 ? 4 : 0) +
    (roleDepthScore < 82 ? 5 : 0);
  const projected = Math.min(100, overall + projectedLift);

  const issues: Issue[] = [];
  for (const check of ats.checks.filter((item) => !item.passed)) {
    issues.push({
      title: `ATS check failed: ${check.label}`,
      detail: check.detail,
      severity: "bad",
    });
  }
  if (keywordScore < 85) {
    issues.push({
      title: "JD keyword coverage is low",
      detail: `Add exact-match terms such as ${missingKeywords.slice(0, 6).join(", ")}.`,
      severity: keywordScore < 65 ? "bad" : "warning",
    });
  }
  if (impactScore < 90) {
    issues.push({
      title: "Quantify more bullets",
      detail: `${quantifiedCount} of ${bullets.length} impact bullets include numbers. Aim for 75% or higher.`,
      severity: impactScore < 70 ? "bad" : "warning",
    });
  }
  if (orphanFragments.length) {
    issues.push({
      title: "Orphan bullet fragments detected",
      detail: `Fix standalone fragments such as "${orphanFragments[0]}". Every experience/project line must read as a complete sentence.`,
      severity: "bad",
    });
  }
  if (metricLead.metricLeadTotal >= 4 && metricLeadScore < 45) {
    issues.push({
      title: "Metrics are missing from lead clauses",
      detail: `${metricLead.metricLeadCount} of ${metricLead.metricLeadTotal} bullets put concrete numbers early. Put alert volume, case count, time saved, false positives, or accuracy in the lead clause.`,
      severity: "warning",
    });
  }
  if (repeatedVerbs.length) {
    issues.push({
      title: "Repeated action verbs",
      detail: repeatedVerbs.map(([verb, count]) => `${verb}: ${count}`).join(", "),
      severity: "warning",
    });
  }
  if (atsScore < 85) {
    issues.push({
      title: "ATS binary gate is not passing",
      detail: `${ats.checks.filter((check) => check.passed).length}/6 deterministic ATS checks pass. Fix every failed check before submitting.`,
      severity: "bad",
    });
  }
  if (languageScore < 90) {
    issues.push({
      title: "Language cleanup",
      detail: `Remove weak phrases, buzzwords, or pronouns. Found: ${[...weakPhraseHits, ...buzzwordHits].slice(0, 6).join(", ") || "pronoun-heavy wording"}.`,
      severity: languageScore < 70 ? "bad" : "warning",
    });
  }
  if (humanScore < 85) {
    issues.push({
      title: "Human reviewer risk",
      detail:
        human.diagnostics.length > 0
          ? human.diagnostics.slice(0, humanScore < 75 ? 4 : 2).join(" ")
          : "The resume has signs of AI-style keyword stuffing, repeated stock phrasing, or weak evidence density.",
      severity: humanScore < 75 ? "bad" : "warning",
    });
  }
  if (evidenceScore < EVIDENCE_GATE_SCORE) {
    const missingSignals = targetingSignals.filter((signal) => signal.status === "missing").slice(0, 4);
    issues.push({
      title: "JD evidence map is weak",
      detail: missingSignals.length
        ? `Add or emphasize proof for ${missingSignals.map((signal) => signal.label).join(", ")}.`
        : "The resume needs clearer proof for the JD's responsibilities, tools, or outcomes.",
      severity: evidenceScore < 60 ? "bad" : "warning",
    });
  }
  if (roleFitScore < ROLE_FIT_GATE_SCORE) {
    const weakPillars = roleBlueprint.proofPillars.filter((pillar) => pillar.status !== "strong").slice(0, 3);
    issues.push({
      title: "Role blueprint needs tighter proof",
      detail: weakPillars.length
        ? `Strengthen ${weakPillars.map((pillar) => pillar.label).join(", ")} so the resume reads like a direct fit for ${roleBlueprint.targetRole}.`
        : `The resume needs a clearer candidate story for ${roleBlueprint.targetRole}.`,
      severity: roleFitScore < 60 ? "bad" : "warning",
    });
  }
  if (contactScore < 100) {
    issues.push({
      title: "Contact details incomplete",
      detail: "Paid scanners check email and phone because missing contact info can block recruiter follow-up.",
      severity: "warning",
    });
  }
  if (!issues.length) {
    issues.push({
      title: "Strong resume/JD alignment",
      detail: "The resume is passing the main local ATS, impact, keyword, and repetition checks.",
      severity: "good",
    });
  }

  return {
    overall,
    projected,
    ats,
    human,
    domain,
    roleBlueprint,
    evidenceGraph,
    cards: [
      { label: "ATS Readiness", score: atsScore, detail: `${ats.checks.filter((check) => check.passed).length}/6 deterministic ATS checks pass` },
      { label: "JD Match", score: ats.anchorCoverageScore, detail: `${ats.matchedAnchors.length}/${ats.anchors.length || 1} ATS anchors matched` },
      { label: "Impact", score: impactScore, detail: `${quantifiedCount}/${bullets.length} bullets quantified` },
      { label: "Word Choice", score: wordChoiceScore, detail: repeatedVerbs.length ? "Repeated verbs found" : "Verb variety looks good" },
      { label: "Role Depth", score: roleDepthScore, detail: `${bullets.length} impact lines detected` },
      {
        label: "Human Screen",
        score: humanScore,
        detail:
          human.band === "strong"
            ? "Concrete, recruiter-readable wording"
            : human.band === "acceptable"
              ? "Acceptable, with a few readability fixes"
              : "Recruiter rejection risk detected",
      },
      { label: "Evidence Match", score: evidenceScore, detail: `${targetingSignals.filter((signal) => signal.status === "strong").length}/${targetingSignals.length || 1} JD signals strongly proven` },
      { label: "Role Fit", score: roleFitScore, detail: `${roleBlueprint.proofPillars.filter((pillar) => pillar.status === "strong").length}/${roleBlueprint.proofPillars.length || 1} proof pillars strong` },
      { label: "Line Hygiene", score: lineHygieneScore, detail: orphanFragments.length ? `${orphanFragments.length} orphan fragments detected` : "No dangling resume fragments" },
      { label: "Metric Lead", score: metricLeadScore, detail: `${metricLead.metricLeadCount}/${metricLead.metricLeadTotal} bullets lead with concrete numbers` },
    ],
    gates,
    targetingSignals,
    proChecks: [
      ...ats.checks.map((check) => ({
        label: check.label,
        score: check.passed ? 100 : 0,
        detail: check.detail,
      })),
      { label: "Contact Check", score: contactScore, detail: emailFound && phoneFound ? "Email and phone detected" : "Add email and phone" },
      { label: "Date Formatting", score: dateScore, detail: `${dateMatches.length} role date ranges detected; ATS formats: ${ats.dateFormats.join(", ") || "none"}` },
      ...(human.band === "strong"
        ? []
        : (Object.entries(human.subscores) as Array<[keyof HumanSubscores, number]>)
            .sort((a, b) => a[1] - b[1])
            .slice(0, human.band === "risk" ? 6 : 2)
            .map(([label, score]) => ({
              label: `Human ${humanSubscoreLabel(label)}`,
              score,
              detail: `${humanSubscoreLabel(label)} subscore from deterministic human-screen checks.`,
            }))),
      { label: "Bullet Length", score: bulletLengthScore, detail: "Checks whether bullets are scan-friendly" },
      { label: "Language Quality", score: languageScore, detail: "Weak phrases, buzzwords, and pronouns" },
      { label: "Job Title Match", score: titleMatchScore, detail: `${titleMatchHits}/${Math.max(1, titleWords.length)} title terms found` },
      { label: "Role Blueprint", score: roleFitScore, detail: `${roleBlueprint.targetRole}: ${roleBlueprint.proofPillars.filter((pillar) => pillar.status !== "strong").length} proof gaps` },
    ],
    bulletReviews,
    issues,
    matchedKeywords,
    missingKeywords,
    repeatedVerbs,
    quantified: { quantified: quantifiedCount, total: bullets.length },
    hygiene: { orphanFragments, metricLeadCount: metricLead.metricLeadCount, metricLeadTotal: metricLead.metricLeadTotal },
    bullets,
  };
}

async function extractPdfText(file: File) {
  const pdfjsLib = await loadPdfRuntime();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const chunks: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : [0, 0, 0, 0, 0, 0];
      const y = Math.round(Number(transform[5] || 0));
      const x = Number(transform[4] || 0);
      const row = rows.get(y) ?? [];
      row.push({ x, text: item.str });
      rows.set(y, row);
    }
    const pageLines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text.trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
    chunks.push(pageLines.join("\n"));
  }
  return chunks.join("\n");
}

function statusClass(score: number) {
  if (score >= 90) return "excellent";
  if (score >= 80) return "strong";
  if (score >= 65) return "needs-work";
  return "weak";
}

function normalizeResumeLines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd().split("\n");
}

function isProtectedHeading(line: string) {
  const trimmed = line.trim();
  return /^[A-Z][A-Z0-9 /&().,-]{2,}$/.test(trimmed) && trimmed.length <= 42;
}

function isFixedFactLine(line: string, index: number) {
  const trimmed = line.trim();
  return (
    index === 0 ||
    /@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(trimmed) ||
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/.test(trimmed) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\s*-\s*(?:present|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/i.test(trimmed) ||
    /\b(?:bachelor|master|ph\.?d|university|college|school|degree|gpa|cgpa|certification|certified)\b/i.test(trimmed) ||
    /^[A-Z][A-Za-z0-9 .,&'()/-]{2,80}\s*\|\s*[A-Za-z .,-]{2,80}$/.test(trimmed)
  );
}

function editableResumeLines(lines: string[]) {
  const editable = new Set<number>();
  let currentSection = "";
  let activeBullet = false;
  let previousEditableText = "";

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (/^SUMMARY$/.test(upper)) {
      currentSection = "SUMMARY";
      activeBullet = false;
      previousEditableText = "";
      return;
    }
    if (/^(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|PROJECTS|PROJECT EXPERIENCE)$/.test(upper)) {
      currentSection = upper;
      activeBullet = false;
      previousEditableText = "";
      return;
    }
    if (/^(SKILLS|TECHNICAL SKILLS|EDUCATION|CERTIFICATIONS|CONTACT|AWARDS|ACTIVITIES)$/.test(upper)) {
      currentSection = upper;
      activeBullet = false;
      previousEditableText = "";
      return;
    }
    if (isProtectedHeading(trimmed)) {
      activeBullet = false;
      previousEditableText = "";
      return;
    }

    if (currentSection === "SUMMARY") {
      activeBullet = false;
      if (trimmed.length > 35 && !isFixedFactLine(line, index)) editable.add(index);
      previousEditableText = trimmed;
      return;
    }

    if (!isExperienceSection(currentSection) && !isProjectSection(currentSection)) {
      activeBullet = false;
      previousEditableText = "";
      return;
    }

    if (isProjectSection(currentSection) && isProjectTitleLine(trimmed)) {
      activeBullet = false;
      previousEditableText = "";
      return;
    }

    const startsBullet = startsNewImpactLine(trimmed);
    const continuesBullet = activeBullet && isContinuationVisualLine(previousEditableText, trimmed);
    const orphanTail = activeBullet && isLikelyOrphanFragmentLine(trimmed, index);
    if ((startsBullet || continuesBullet || orphanTail) && !isProtectedHeading(line) && !isFixedFactLine(line, index)) {
      editable.add(index);
      activeBullet = true;
      previousEditableText = `${previousEditableText} ${cleanResumeLine(trimmed)}`.replace(/\s+/g, " ").trim();
      return;
    }

    activeBullet = false;
    previousEditableText = "";
  });

  return editable;
}

function validateFormatLock(before: string, after: string) {
  const beforeLines = normalizeResumeLines(before);
  const afterLines = normalizeResumeLines(after);
  const editableLines = editableResumeLines(beforeLines);
  const issues: string[] = [];

  if (beforeLines.length !== afterLines.length) {
    issues.push(`line count changed from ${beforeLines.length} to ${afterLines.length}`);
  }

  const comparableLines = Math.min(beforeLines.length, afterLines.length);
  for (let index = 0; index < comparableLines; index += 1) {
    const beforeLine = beforeLines[index] ?? "";
    const afterLine = afterLines[index] ?? "";
    if (!beforeLine.trim() && afterLine.trim()) {
      issues.push(`blank line ${index + 1} was filled`);
    }
    if (beforeLine.trim() && !afterLine.trim()) {
      issues.push(`content line ${index + 1} was removed`);
    }
    if (isProtectedHeading(beforeLine) && beforeLine.trim() !== afterLine.trim()) {
      issues.push(`section/header line ${index + 1} changed`);
    }
    if (beforeLine.trim() !== afterLine.trim() && !editableLines.has(index)) {
      issues.push(`non-summary/experience/project content line ${index + 1} changed`);
    }
    if (issues.length >= 4) break;
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function readSavedScans(): SavedScan[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedScan[];
  } catch {
    return [];
  }
}

function openSessionDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = window.indexedDB.open(SESSION_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_DB_STORE)) db.createObjectStore(SESSION_DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local resume session storage."));
  });
}

async function storeSourcePdfBlob(blob: Blob) {
  const db = await openSessionDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_DB_STORE, "readwrite");
      tx.objectStore(SESSION_DB_STORE).put({ id: ACTIVE_SOURCE_PDF_KEY, source_pdf_blob: blob, blob, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not store original PDF locally."));
    });
  } finally {
    db.close();
  }
}

async function storeSessionData(data: StoredSessionData) {
  const db = await openSessionDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_DB_STORE, "readwrite");
      tx.objectStore(SESSION_DB_STORE).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not store local session data."));
    });
  } finally {
    db.close();
  }
}

async function readSessionData() {
  const db = await openSessionDb();
  try {
    return await new Promise<StoredSessionData | null>((resolve, reject) => {
      const tx = db.transaction(SESSION_DB_STORE, "readonly");
      const request = tx.objectStore(SESSION_DB_STORE).get(ACTIVE_SOURCE_PDF_KEY);
      request.onsuccess = () => resolve((request.result as StoredSessionData | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error("Could not restore local session data."));
    });
  } finally {
    db.close();
  }
}

async function readSourcePdfBlob() {
  const db = await openSessionDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(SESSION_DB_STORE, "readonly");
      const request = tx.objectStore(SESSION_DB_STORE).get(ACTIVE_SOURCE_PDF_KEY);
      request.onsuccess = () => {
        const blob = request.result?.source_pdf_blob ?? request.result?.blob;
        resolve(blob instanceof Blob ? blob : null);
      };
      request.onerror = () => reject(request.error || new Error("Could not restore original PDF."));
    });
  } finally {
    db.close();
  }
}

async function clearSourcePdfBlob() {
  const db = await openSessionDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_DB_STORE, "readwrite");
      tx.objectStore(SESSION_DB_STORE).delete(ACTIVE_SOURCE_PDF_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not clear original PDF."));
    });
  } finally {
    db.close();
  }
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readActiveSession(): ActiveSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) ?? "null") as (Partial<ActiveSession> & Partial<ActiveSessionMetadata>) | null;
    if (!parsed) return null;
    if (parsed.version === 2) {
      return {
        version: 1,
        updatedAt: String(parsed.last_modified || new Date().toISOString()),
        resumeText: DEFAULT_RESUME,
        jdText: DEFAULT_JD,
        fileName: parsed.filename ?? null,
        sourceFileName: parsed.source_filename ?? parsed.filename ?? null,
        sourceSessionId: parsed.session_id && parsed.session_id !== "browser-only" ? parsed.session_id : null,
        sourceFormatText: null,
        sourcePdfBase64: null,
        backendWorkflowReport: null,
        scanResult: null,
        aiMagicBullets: null,
        aiTailorChanges: [],
        aiTailorResult: null,
        finalFileStatus: parsed.rewrite_state?.final_status ?? null,
        downloadFileName: parsed.rewrite_state?.download_filename || rewrittenPdfFileName(parsed.source_filename ?? parsed.filename ?? null),
      };
    }
    if (parsed.version !== 1 || typeof parsed.resumeText !== "string" || typeof parsed.jdText !== "string") return null;
    const resumeText = parsed.resumeText;
    const jdText = parsed.jdText;
    const scanResult =
      parsed.scanResult && typeof parsed.scanResult === "object"
        ? {
            createdAt: String(parsed.scanResult.createdAt || parsed.updatedAt || new Date().toISOString()),
            resumeText,
            jdText,
            analysis: gradeAnalysis(resumeText, jdText),
          }
        : null;
    return {
      version: 1,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
      resumeText,
      jdText,
      fileName: parsed.fileName ?? null,
      sourceFileName: parsed.sourceFileName ?? null,
      sourceSessionId: parsed.sourceSessionId ?? null,
      sourceFormatText: parsed.sourceFormatText ?? null,
      sourcePdfBase64: parsed.sourcePdfBase64 ?? null,
      backendWorkflowReport: parsed.backendWorkflowReport ?? null,
      scanResult,
      aiMagicBullets: Array.isArray(parsed.aiMagicBullets) ? parsed.aiMagicBullets : null,
      aiTailorChanges: Array.isArray(parsed.aiTailorChanges) ? parsed.aiTailorChanges.map(String).slice(0, 12) : [],
      aiTailorResult: parsed.aiTailorResult ?? null,
      finalFileStatus: parsed.finalFileStatus ?? null,
      downloadFileName: parsed.downloadFileName || rewrittenPdfFileName(parsed.sourceFileName ?? null),
    };
  } catch {
    return null;
  }
}

function writeActiveSession(session: ActiveSession) {
  const anchors = session.backendWorkflowReport?.anchors ?? session.scanResult?.analysis.ats.anchors ?? [];
  const missing = session.backendWorkflowReport?.gap_analysis
    ? anchors.filter((anchor) => session.backendWorkflowReport?.gap_analysis?.[anchor]?.status === "missing")
    : session.scanResult?.analysis.ats.missingAnchors ?? [];
  const metadataSession: ActiveSessionMetadata = {
    version: 2,
    session_id: session.sourceSessionId || "browser-only",
    filename: session.fileName,
    source_filename: session.sourceFileName,
    jd_hash: String(hashText(session.jdText)),
    score_snapshot: session.scanResult
      ? {
          ats_pass: session.scanResult.analysis.ats.passed,
          human_readability: session.scanResult.analysis.human.score,
          jd_fit: `${Math.max(0, anchors.length - missing.length)}/${anchors.length || 1}`,
          overall: session.scanResult.analysis.overall,
        }
      : null,
    rewrite_state: {
      has_scan: Boolean(session.scanResult),
      has_ai_tailor: Boolean(session.aiTailorResult),
      final_status: session.finalFileStatus,
      download_filename: session.downloadFileName,
    },
    last_modified: session.updatedAt,
  };
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(metadataSession));
  } catch {
    const compactSession: ActiveSessionMetadata = {
      ...metadataSession,
      rewrite_state: {
        ...metadataSession.rewrite_state,
        final_status: {
          type: "skipped",
          message: "Workspace metadata could not be fully stored locally. Keep this tab open until you save the PDF.",
        },
      },
    };
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(compactSession));
    } catch {
      // Keep the live workspace usable even if browser storage is full.
    }
  }
}

function sanitizePdfFileName(fileName: string) {
  const clean = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean || "rewritten-resume-ats-rewrite"}.pdf`;
}

function rewrittenPdfFileName(sourceFileName: string | null) {
  const stem = sourceFileName ? sourceFileName.replace(/\.[^.]+$/, "") : "rewritten-resume";
  return sanitizePdfFileName(`${stem || "rewritten-resume"}-ats-rewrite.pdf`);
}

function fallbackDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function savePdfWithPicker(blob: Blob, fileName: string) {
  const cleanFileName = sanitizePdfFileName(fileName);
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (picker) {
    const handle = await picker({
      suggestedName: cleanFileName,
      types: [{ description: "PDF Resume", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { fileName: cleanFileName, pickedLocation: true };
  }

  fallbackDownload(blob, cleanFileName);
  return { fileName: cleanFileName, pickedLocation: false };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read original PDF."));
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not restore original PDF."));
    reader.readAsDataURL(blob);
  });
}

async function uploadPdfToBackend(fileName: string, sourcePdfBase64: string) {
  const response = await fetch("/api/upload-resume-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      sourcePdfBase64,
      metadata: { uploadedAt: new Date().toISOString() },
    }),
  });
  const data = (await response.json().catch(() => ({}))) as PdfUploadResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || `PDF upload session failed with HTTP ${response.status}.`);
  return data;
}

async function callRewriteResumeBackend(scanResult: ScanAnalysis): Promise<RewriteResumeResponse> {
  const response = await fetch("/api/rewrite-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scanResult }),
  });
  const data = (await response.json().catch(() => ({}))) as RewriteResumeResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || `Rewrite failed with HTTP ${response.status}.`);
  return data;
}

async function scoreResumeOnBackend(resumeText: string, jdText: string, sessionId: string | null): Promise<ScanResponse> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      resumeText,
      jdText,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as ScanResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || `Scan failed with HTTP ${response.status}.`);
  if (!data.result || !data.result.fit_analysis) {
    throw new Error("Scan returned an incomplete response. The LLM may have degraded; please re-scan.");
  }
  return data;
}

function pdfBlobFromBase64(base64: string) {
  const binary = atob(base64);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < binary.length; offset += 8192) {
    const slice = binary.slice(offset, offset + 8192);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }
    chunks.push(buffer);
  }
  return new Blob(chunks, { type: "application/pdf" });
}

function roleBlueprintRequest(blueprint: RoleBlueprint) {
  return {
    targetRole: blueprint.targetRole,
    roleThesis: blueprint.roleThesis,
    atsFocus: blueprint.atsFocus.slice(0, 18),
    rewriteStrategy: blueprint.rewriteStrategy.slice(0, 6),
    humanWarnings: blueprint.humanWarnings.slice(0, 6),
    proofPillars: blueprint.proofPillars.slice(0, 8).map((pillar) => ({
      label: pillar.label,
      score: pillar.score,
      status: pillar.status,
      jdNeed: pillar.jdNeed,
      resumeProof: pillar.resumeProof,
      terms: pillar.terms.slice(0, 6),
    })),
  };
}

function evidenceGraphRequest(graph: EvidenceGraph) {
  return {
    employers: graph.employers.slice(0, 18),
    dates: graph.dates.slice(0, 18),
    degrees: graph.degrees.slice(0, 12),
    certifications: graph.certifications.slice(0, 12),
    toolsMentioned: graph.toolsMentioned.slice(0, 80),
    frameworks: graph.frameworks.slice(0, 40),
    metrics: graph.metrics.slice(0, 80),
    actionsTaken: graph.actionsTaken.slice(0, 80),
    scope: graph.scope.slice(0, 40),
    roles: graph.roles.slice(0, 20).map((role) => ({
      id: role.id,
      employer: role.employer,
      title: role.title,
      dates: role.dates,
      section: role.section,
      startLine: role.startLine,
      endLine: role.endLine,
      allowedTools: role.allowedTools.slice(0, 40),
      allowedMetrics: role.allowedMetrics.slice(0, 40),
      allowedActions: role.allowedActions.slice(0, 40),
      allowedObjects: role.allowedObjects.slice(0, 30),
      allowedOutcomes: role.allowedOutcomes.slice(0, 20),
      scopeEvidence: role.scopeEvidence.slice(0, 16),
    })),
    sectionTools: Object.fromEntries(Object.entries(graph.sectionTools).slice(0, 16).map(([section, tools]) => [section, tools.slice(0, 30)])),
  };
}

function App() {
  const [restoredSession] = useState(readActiveSession);
  const [resumeText, setResumeText] = useState(restoredSession?.resumeText ?? DEFAULT_RESUME);
  const [jdText, setJdText] = useState(restoredSession?.jdText ?? DEFAULT_JD);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(restoredSession?.fileName ?? null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(restoredSession?.sourceFileName ?? null);
  const [sourceSessionId, setSourceSessionId] = useState<string | null>(restoredSession?.sourceSessionId ?? null);
  const [sourcePdfFile, setSourcePdfFile] = useState<File | null>(null);
  const [sourcePdfBlob, setSourcePdfBlob] = useState<Blob | null>(null);
  const [sourceFormatText, setSourceFormatText] = useState<string | null>(restoredSession?.sourceFormatText ?? null);
  const [sourcePdfBase64, setSourcePdfBase64] = useState<string | null>(restoredSession?.sourcePdfBase64 ?? null);
  const [sourceBinaryLoaded, setSourceBinaryLoaded] = useState(!restoredSession?.sourceFileName);
  const [backendWorkflowReport, setBackendWorkflowReport] = useState<BackendWorkflowReport | null>(restoredSession?.backendWorkflowReport ?? null);
  const [scanAnalysis, setScanAnalysis] = useState<ScanAnalysis | null>(null);
  const [rewriteResponse, setRewriteResponse] = useState<RewriteResumeResponse | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteElapsedSec, setRewriteElapsedSec] = useState(0);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(restoredSession?.scanResult ?? null);
  const [savedScans, setSavedScans] = useState<SavedScan[]>(readSavedScans);
  const [aiMagicBullets, setAiMagicBullets] = useState<MagicBullet[] | null>(restoredSession?.aiMagicBullets ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTailorLoading, setAiTailorLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTailorChanges, setAiTailorChanges] = useState<string[]>(restoredSession?.aiTailorChanges ?? []);
  const [aiTailorResult, setAiTailorResult] = useState<{ before: number; after: number } | null>(restoredSession?.aiTailorResult ?? null);
  const [finalFileStatus, setFinalFileStatus] = useState<FinalFileStatus | null>(restoredSession?.finalFileStatus ?? null);
  const [finalSaving, setFinalSaving] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState(restoredSession?.downloadFileName ?? rewrittenPdfFileName(null));
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const analysis = scanResult?.analysis ?? EMPTY_ANALYSIS;
  const hasScanned = Boolean(scanResult);
  const magicBullets = useMemo(
    () => (hasScanned ? buildMagicBullets(analysis, jdText) : []),
    [analysis, jdText, hasScanned],
  );
  const displayMagicBullets = aiMagicBullets ?? magicBullets;
  const recommendedBullets = useMemo(() => (hasScanned ? selectSampleBullets(analysis, jdText) : []), [analysis, jdText, hasScanned]);
  const proFeatureMap = useMemo(() => (hasScanned ? buildProFeatureMap(analysis, savedScans) : []), [analysis, savedScans, hasScanned]);
  const gatePassed = hasScanned && passesQualityGates(analysis);
  const hasFormatSource = Boolean(sourceFormatText && sourceBinaryLoaded && (sourceSessionId || sourcePdfFile || sourcePdfBlob || sourcePdfBase64));
  const workflowAnchors = backendWorkflowReport?.anchors?.length ? backendWorkflowReport.anchors : analysis.ats.anchors;
  const workflowGapAnalysis = backendWorkflowReport?.gap_analysis ?? {};
  const workflowMissingAnchors = workflowAnchors.filter((anchor) => workflowGapAnalysis[anchor]?.status === "missing" || (!workflowGapAnalysis[anchor] && analysis.ats.missingAnchors.includes(anchor)));
  const workflowCoveredCount = Math.max(0, workflowAnchors.length - workflowMissingAnchors.length);
  const workflowFitLabel = scanAnalysis?.overall.fit_score || backendWorkflowReport?.fit_score || `${workflowCoveredCount}/${workflowAnchors.length || 1}`;
  const displayAtsPassed = scanAnalysis?.ats_assessment.passed ?? analysis.ats.passed;
  const displayAtsChecks = scanAnalysis
    ? scanAnalysis.ats_assessment.checks.map((check) => ({
        key: check.name,
        label: check.name,
        passed: check.passed,
        detail: check.note,
      }))
    : analysis.ats.checks;
  const displayHumanScore = scanAnalysis?.human_readability.score ?? analysis.human.score;
  const displayHumanSubscores = scanAnalysis
    ? Object.entries(scanAnalysis.human_readability.subscores).map(([label, score]) => [label.replace(/_/g, " "), score] as const)
    : (Object.entries(analysis.human.subscores) as Array<[keyof HumanSubscores, number]>).map(([label, score]) => [humanSubscoreLabel(label), score] as const);

  useEffect(() => {
    writeActiveSession({
      version: 1,
      updatedAt: new Date().toISOString(),
      resumeText,
      jdText,
      fileName,
      sourceFileName,
      sourceSessionId,
      sourceFormatText,
      sourcePdfBase64,
      backendWorkflowReport,
      scanResult,
      aiMagicBullets,
      aiTailorChanges,
      aiTailorResult,
      finalFileStatus,
      downloadFileName,
    });
  }, [
    resumeText,
    jdText,
    fileName,
    sourceFileName,
    sourceSessionId,
    sourceFormatText,
    sourcePdfBase64,
    backendWorkflowReport,
    scanResult,
    aiMagicBullets,
    aiTailorChanges,
    aiTailorResult,
    finalFileStatus,
    downloadFileName,
  ]);

  useEffect(() => {
    if (!rewriteLoading) {
      setRewriteElapsedSec(0);
      return;
    }
    const interval = setInterval(() => {
      setRewriteElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [rewriteLoading]);

  useEffect(() => {
    if (!resumeText && !jdText) return;
    if (restoredSession?.sourceFileName && !sourceBinaryLoaded && !sourceFormatText) return;
    const blob = sourcePdfBlob ?? sourcePdfFile;
    void storeSessionData({
      id: ACTIVE_SOURCE_PDF_KEY,
      session_id: sourceSessionId || "browser-only",
      source_pdf_blob: blob ?? null,
      original_text: sourceFormatText,
      rewritten_text: resumeText,
      evidence_graph: analysis.evidenceGraph,
      jd_text: jdText,
      jd_anchors: backendWorkflowReport?.anchors ?? analysis.ats.anchors,
      backend_workflow_report: backendWorkflowReport,
      scan_result: scanResult,
      ai_tailor_changes: aiTailorChanges,
      ai_tailor_result: aiTailorResult,
      updated_at: new Date().toISOString(),
    }).catch(() => undefined);
  }, [
    resumeText,
    jdText,
    sourceFileName,
    sourceSessionId,
    sourcePdfFile,
    sourcePdfBlob,
    sourceFormatText,
    backendWorkflowReport,
    scanResult,
    aiTailorChanges,
    aiTailorResult,
    analysis.evidenceGraph,
    analysis.ats.anchors,
    restoredSession?.sourceFileName,
    sourceBinaryLoaded,
  ]);

  useEffect(() => {
    if (!restoredSession?.sourceFileName) return;
    let cancelled = false;
    readSessionData()
      .then(async (data) => {
        if (!data || cancelled) return;
        if (data.rewritten_text) setResumeText(data.rewritten_text);
        if (data.jd_text) setJdText(data.jd_text);
        if (data.original_text) setSourceFormatText(data.original_text);
        if (data.backend_workflow_report) setBackendWorkflowReport(data.backend_workflow_report);
        if (data.scan_result) setScanResult(data.scan_result);
        if (Array.isArray(data.ai_tailor_changes)) setAiTailorChanges(data.ai_tailor_changes);
        if (data.ai_tailor_result) setAiTailorResult(data.ai_tailor_result);
        const blob = data.source_pdf_blob;
        if (blob instanceof Blob) {
          setSourcePdfBlob(blob);
          const restoredBase64 = await blobToBase64(blob);
          if (!cancelled) setSourcePdfBase64(restoredBase64);
        }
        if (!cancelled) setSourceBinaryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setSourceBinaryLoaded(true);
          setFinalFileStatus({
            type: "skipped",
            message: "Workspace restored, but the original PDF blob was not available. Re-upload the same PDF before saving.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restoredSession?.sourceFileName]);

  function setResumeDraft(nextText: string) {
    setResumeText(nextText);
    setScanResult(null);
    setBackendWorkflowReport(null);
    setScanAnalysis(null);
    setAiMagicBullets(null);
    setAiError(null);
    setAiTailorChanges([]);
    setAiTailorResult(null);
    setFinalFileStatus(null);
  }

  function setJobDraft(nextText: string) {
    setJdText(nextText);
    setScanResult(null);
    setBackendWorkflowReport(null);
    setScanAnalysis(null);
    setAiMagicBullets(null);
    setAiError(null);
    setAiTailorChanges([]);
    setAiTailorResult(null);
    setFinalFileStatus(null);
  }

  async function runRewriteResume() {
    if (!scanAnalysis) return;
    if (rewriteLoading) return;
    setRewriteLoading(true);
    setRewriteError(null);
    setRewriteElapsedSec(0);
    try {
      const result = await callRewriteResumeBackend(scanAnalysis);
      setRewriteResponse(result);
    } catch (error: any) {
      setRewriteError(error?.message || "Rewrite failed; please try again.");
      setRewriteResponse(null);
    } finally {
      setRewriteLoading(false);
    }
  }

  function handleCopyPrompt() {
    if (!rewriteResponse?.prompt) return;
    navigator.clipboard.writeText(rewriteResponse.prompt).catch(() => {
      alert("Could not copy to clipboard. Please select and copy the text manually.");
    });
  }

  function handleDownloadPrompt() {
    if (!rewriteResponse?.prompt) return;
    const blob = new Blob([rewriteResponse.prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tailored-resume-prompt-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleRegenerateClick() {
    setShowRegenerateConfirm(true);
  }

  function handleRegenerateConfirm() {
    setShowRegenerateConfirm(false);
    setRewriteResponse(null);
    runRewriteResume();
  }

  function handleRegenerateCancel() {
    setShowRegenerateConfirm(false);
  }

  async function runScan() {
    if (loading) return;
    setLoading(true);
    const nextAnalysis = gradeAnalysis(resumeText, jdText);
    setScanResult({
      createdAt: new Date().toISOString(),
      resumeText,
      jdText,
      analysis: nextAnalysis,
    });
    setAiMagicBullets(null);
    setAiError(null);
    setAiTailorChanges([]);
    setAiTailorResult(null);
    setFinalFileStatus(null);
    setScanAnalysis(null);
    try {
      const scanResponse = await scoreResumeOnBackend(resumeText, jdText, sourceSessionId);
      setScanAnalysis(scanResponse.result);
      setRewriteResponse(null);
      setRewriteError(null);
      // Bridge to legacy backendWorkflowReport so existing UI elements keep working until full migration:
      const bridgedReport: BackendWorkflowReport = {
        ats_pass: scanResponse.result.ats_assessment.passed,
        ats_checks: scanResponse.result.ats_assessment.checks.map((c) => ({
          key: c.name.replace(/\s+/g, "-").toLowerCase(),
          label: c.name,
          passed: c.passed,
          detail: c.note,
        })),
        human_score: scanResponse.result.human_readability.score,
        human_subscores: scanResponse.result.human_readability.subscores as Record<string, number>,
        anchors: scanResponse.result.fit_analysis.map((f) => f.jd_requirement),
        gap_analysis: Object.fromEntries(
          scanResponse.result.fit_analysis.map((f) => [
            f.jd_requirement,
            {
              status: (f.evidence_status === "STRONG_MATCH" || f.evidence_status === "PARTIAL_MATCH") ? "covered" :
                (f.evidence_status === "WEAK_MATCH" ? "partial" : "missing"),
              evidence: f.match_quality,
            },
          ])
        ),
        fit_score: scanResponse.result.overall.fit_score,
        diagnostic_messages: scanResponse.result.human_readability.diagnostics,
      };
      setBackendWorkflowReport(bridgedReport);
    } catch (error) {
      setScanAnalysis(null);
      setBackendWorkflowReport({
        status: "error",
        sessionId: sourceSessionId,
        diagnostic_messages: [error instanceof Error ? error.message : "Backend score workflow was unavailable."],
      });
    } finally {
      setLoading(false);
    }
  }

  function saveCurrentScan() {
    if (!scanResult) return;
    const firstJdLine = jdText.split(/\n+/).find((line) => line.trim().length > 8)?.trim() ?? "Untitled scan";
    const scan: SavedScan = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      score: scanResult.analysis.overall,
      projected: scanResult.analysis.projected,
      title: firstJdLine.slice(0, 90),
      resumeText,
      jdText,
    };
    const next = [scan, ...savedScans].slice(0, 12);
    setSavedScans(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function loadScan(scan: SavedScan) {
    setResumeDraft(scan.resumeText);
    setJobDraft(scan.jdText);
    setFileName(null);
    setSourceFileName(null);
    setSourceSessionId(null);
    setSourcePdfFile(null);
    setSourcePdfBlob(null);
    setSourceFormatText(null);
    setSourcePdfBase64(null);
    setSourceBinaryLoaded(true);
    setBackendWorkflowReport(null);
    setScanAnalysis(null);
    setDownloadFileName(rewrittenPdfFileName(null));
    const nextAnalysis = gradeAnalysis(scan.resumeText, scan.jdText);
    setScanResult({
      createdAt: scan.createdAt,
      resumeText: scan.resumeText,
      jdText: scan.jdText,
      analysis: nextAnalysis,
    });
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setFileName(file.name);
    setSourceFileName(file.name);
    setDownloadFileName(rewrittenPdfFileName(file.name));
    setSourceSessionId(null);
    setSourcePdfFile(null);
    setSourcePdfBlob(null);
    setSourceFormatText(null);
    setSourcePdfBase64(null);
    setSourceBinaryLoaded(false);
    setBackendWorkflowReport(null);
    setScanAnalysis(null);
    try {
      let extractedText = "";
      let uploadWarning: string | null = null;
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pdfBase64 = await fileToBase64(file);
        await storeSourcePdfBlob(file).catch(() => undefined);
        try {
          const upload = await uploadPdfToBackend(file.name, pdfBase64);
          if (upload.sessionId) setSourceSessionId(upload.sessionId);
          if (upload.text && upload.text.trim().length > 200) extractedText = upload.text;
        } catch (error) {
          uploadWarning =
            error instanceof Error ? `Server PDF session was unavailable; using browser PDF parsing. ${error.message}` : "Server PDF session was unavailable; using browser PDF parsing.";
        }
        if (!extractedText) extractedText = await extractPdfText(file);
        setSourcePdfFile(file);
        setSourcePdfBlob(file);
        setSourceFormatText(extractedText);
        setSourcePdfBase64(pdfBase64);
        setSourceBinaryLoaded(true);
      } else {
        void clearSourcePdfBlob().catch(() => undefined);
        setSourceSessionId(null);
        setSourceBinaryLoaded(true);
        extractedText = await file.text();
      }
      setResumeDraft(extractedText);
      if (uploadWarning) {
        setFinalFileStatus({
          type: "skipped",
          message: uploadWarning,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <h1>Local ATS Scanner</h1>
          <p>Private resume scoring, JD matching, and paid-tool style optimization.</p>
        </div>
        <div className="top-actions">
          <div className="lift-pill">
            <ClipboardList size={17} />
            <span>{hasScanned ? analysis.domain.name : "Ready to scan"}</span>
          </div>
          <button className="primary-button" type="button" onClick={runScan} disabled={!resumeText.trim() || !jdText.trim() || loading}>
            <ListChecks size={16} />
            Scan resume
          </button>
          <button className="primary-button" type="button" onClick={saveCurrentScan} disabled={!hasScanned}>
            <Save size={16} />
            Save report
          </button>
          {hasScanned && (
            <div className={`lift-pill ${gatePassed ? "gate-pass" : "gate-watch"}`}>
              {gatePassed ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              <span>{gatePassed ? "Ready to submit" : "Needs targeting"}</span>
            </div>
          )}
        </div>
      </section>

      <section className="workspace">
        <div className="panel input-panel">
          <div className="panel-title">
            <FileText size={18} />
            <h2 id="resume-editor-label">Resume</h2>
          </div>
          <label className="upload-target">
            <Upload size={18} />
            <span>{loading ? "Reading PDF locally..." : fileName ?? "Upload PDF or text"}</span>
            <input id="resume-file" name="resume-file" type="file" accept=".pdf,.txt,.md" onChange={(event) => onFile(event.target.files?.[0])} />
          </label>
          <textarea
            id="resume-editor"
            name="resume"
            aria-labelledby="resume-editor-label"
            value={resumeText}
            onChange={(event) => setResumeDraft(event.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="panel input-panel">
          <div className="panel-title">
            <ClipboardList size={18} />
            <h2 id="jd-editor-label">Job Description</h2>
          </div>
          <button className="quiet-button" type="button" onClick={() => setJobDraft(DEFAULT_JD)}>
            <RefreshCw size={16} />
            Reset sample
          </button>
          <textarea
            id="jd-editor"
            name="job-description"
            aria-labelledby="jd-editor-label"
            value={jdText}
            onChange={(event) => setJobDraft(event.target.value)}
            spellCheck={false}
          />
        </div>
      </section>

      {!hasScanned ? (
        <section className="panel scan-gate">
          <div className="panel-title">
            <Gauge size={18} />
            <h2>Ready For ATS Scan</h2>
          </div>
          <p>Upload or paste a resume, paste the job description, then run a scan. The first scan scores only; it does not rewrite the resume.</p>
          <button className="primary-button" type="button" onClick={runScan} disabled={!resumeText.trim() || !jdText.trim() || loading}>
            <ListChecks size={16} />
            Scan resume
          </button>
        </section>
      ) : (
        <>
      <section className="decision-grid">
        <article className={`decision-card ${displayAtsPassed ? "pass" : "watch"}`}>
          <span>ATS Pass</span>
          <strong>{displayAtsPassed ? "âœ“" : "âœ—"}</strong>
          <ul>
            {displayAtsChecks.map((check) => (
              <li key={check.key}>
                {check.passed ? "âœ“" : "âœ—"} {check.label}
              </li>
            ))}
          </ul>
        </article>
        <article className={`decision-card ${displayHumanScore >= 85 ? "pass" : "watch"}`}>
          <span>Human Readability</span>
          <strong>{displayHumanScore}</strong>
          {displayHumanScore < 85 && (
            <ul>
              {displayHumanSubscores
                .sort((a, b) => a[1] - b[1])
                .slice(0, 6)
                .map(([label, score]) => (
                  <li key={label}>
                    {label}: {score}
                  </li>
                ))}
            </ul>
          )}
          {displayHumanScore >= 85 && <p>Strong recruiter readability.</p>}
        </article>
        <article className={`decision-card ${workflowMissingAnchors.length ? "watch" : "pass"}`}>
          <span>JD Fit</span>
          <strong>{workflowFitLabel}</strong>
          <p>{workflowAnchors.length ? `${workflowCoveredCount} of ${workflowAnchors.length} anchors covered.` : "No distinctive anchors extracted."}</p>
        </article>
      </section>

        {scanAnalysis && (
          <section className="scan-analysis-panel">
            <header className="panel-header">
              <h2>Deep Analysis</h2>
              <span className={`recommendation-badge recommendation-${scanAnalysis.overall.recommendation.toLowerCase().replace("_", "-")}`}>
                {scanAnalysis.overall.recommendation.replace("_", " ")}
              </span>
            </header>

            <div className="panel-section">
              <h3>Recommendation</h3>
              <p>{scanAnalysis.overall.recommendation_reasoning}</p>
            </div>

            {scanAnalysis.jd_summary.deal_breakers.length > 0 && (
              <div className="panel-section">
                <h3>Deal Breakers</h3>
                <ul>
                  {scanAnalysis.jd_summary.deal_breakers.map((db, idx) => (
                    <li key={idx}>{db}</li>
                  ))}
                </ul>
                {scanAnalysis.overall.deal_breaker_check && (
                  <p className="deal-breaker-check"><strong>Check:</strong> {scanAnalysis.overall.deal_breaker_check}</p>
                )}
              </div>
            )}

            {scanAnalysis.overall.honest_gaps.length > 0 && (
              <div className="panel-section">
                <h3>Honest Gaps</h3>
                <ul>
                  {scanAnalysis.overall.honest_gaps.map((gap, idx) => (
                    <li key={idx}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="panel-section">
              <h3>Per-Requirement Breakdown ({scanAnalysis.fit_analysis.length} requirements)</h3>
              <div className="requirement-list">
                {scanAnalysis.fit_analysis.map((entry, idx) => (
                  <div key={idx} className={`requirement-card status-${entry.evidence_status.toLowerCase().replace("_", "-")}`}>
                    <header>
                      <span className={`status-badge status-${entry.evidence_status.toLowerCase().replace("_", "-")}`}>
                        {entry.evidence_status.replace("_", " ")}
                      </span>
                      <strong>{entry.jd_requirement}</strong>
                    </header>
                    <p className="match-quality">{entry.match_quality}</p>
                    {entry.current_bullet_text && (
                      <div className="current-bullet">
                        <span className="label">Current bullet:</span>
                        <em>{entry.current_bullet_text}</em>
                      </div>
                    )}
                    {entry.rewrite_needed && entry.rewrite_suggestion && (
                      <div className="rewrite-suggestion">
                        <span className="label">Suggested rewrite guidance:</span>
                        <p>{entry.rewrite_suggestion}</p>
                        {entry.anchor_terms_to_surface.length > 0 && (
                          <p className="anchor-terms">
                            <span className="label">Surface these terms:</span> {entry.anchor_terms_to_surface.join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                    {entry.honest_note && (
                      <p className="honest-note"><strong>Note:</strong> {entry.honest_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-section panel-stats">
              <span>Rewrites needed: <strong>{scanAnalysis.overall.rewrites_recommended}</strong></span>
              <span>No rewrite needed: <strong>{scanAnalysis.overall.rewrites_unnecessary}</strong></span>
              <span>Fit score: <strong>{scanAnalysis.overall.fit_score}</strong></span>
            </div>
          </section>
        )}

        {scanAnalysis && (
          <section className="rewrite-resume-panel">
            <header className="panel-header">
              <h2>Tailor Resume</h2>
            </header>

            {!rewriteResponse && !rewriteLoading && (
              <div className="rewrite-cta">
                {scanAnalysis.overall.rewrites_recommended > 0 ? (
                  <>
                    <p>
                      Generate a tailored version of your resume for this JD. We'll rewrite {scanAnalysis.overall.rewrites_recommended} bullet{scanAnalysis.overall.rewrites_recommended !== 1 ? "s" : ""} using only your existing evidence and produce a Claude.ai-ready prompt for you to use with your base PDF.
                    </p>
                    <button className="primary-button rewrite-button" type="button" onClick={runRewriteResume}>
                      Apply Rewrite ({scanAnalysis.overall.rewrites_recommended} bullet{scanAnalysis.overall.rewrites_recommended !== 1 ? "s" : ""})
                    </button>
                    <p className="rewrite-eta">Expected time: 5-15 minutes</p>
                  </>
                ) : (
                  <p className="rewrite-no-changes">
                    No rewrites needed. Your base resume is already well-positioned for this JD.
                  </p>
                )}
              </div>
            )}

            {rewriteLoading && (
              <div className="rewrite-loading">
                <div className="spinner" />
                <p>Rewriting bullets... this may take 5-15 minutes.</p>
                <p className="elapsed-time">Elapsed: {Math.floor(rewriteElapsedSec / 60)}m {rewriteElapsedSec % 60}s</p>
                <p className="loading-detail">Each bullet is being individually rewritten with strict integrity validation. Don't refresh.</p>
              </div>
            )}

            {rewriteError && !rewriteLoading && (
              <div className="rewrite-error">
                <p><strong>Rewrite failed:</strong> {rewriteError}</p>
                <button className="primary-button" type="button" onClick={runRewriteResume}>Retry</button>
              </div>
            )}

            {rewriteResponse && !rewriteLoading && (
              <div className="rewrite-result">
                {rewriteResponse.no_changes_needed ? (
                  <p className="rewrite-no-changes">{rewriteResponse.message || "No rewrites needed."}</p>
                ) : (
                  <>
                    <div className="rewrite-stats">
                      <span>Rewritten: <strong>{rewriteResponse.stats.rewritten}</strong></span>
                      <span>Failed: <strong>{rewriteResponse.stats.failed}</strong></span>
                      <span>No change: <strong>{rewriteResponse.stats.no_change}</strong></span>
                      <span>Duration: <strong>{Math.round(rewriteResponse.duration_ms / 1000)}s</strong></span>
                    </div>

                    <div className="prompt-preview-header">
                      <h3>Claude.ai-Ready Prompt</h3>
                      <div className="prompt-actions">
                        <button className="action-button" type="button" onClick={handleCopyPrompt}>Copy to Clipboard</button>
                        <button className="action-button" type="button" onClick={handleDownloadPrompt}>Download as .txt</button>
                        <button className="action-button regenerate" type="button" onClick={handleRegenerateClick}>Regenerate</button>
                      </div>
                    </div>

                    <div className="prompt-instructions">
                      <p>Copy this prompt and paste it into Claude.ai along with your base resume PDF. Claude.ai will return a tailored PDF with the same formatting.</p>
                    </div>

                    <pre className="prompt-preview">{rewriteResponse.prompt}</pre>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {showRegenerateConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Regenerate rewrites?</h3>
              <p>This will run all rewrites again. It will take 5-15 minutes.</p>
              <p className="modal-warning">Your current prompt will be replaced.</p>
              <div className="modal-actions">
                <button className="action-button" type="button" onClick={handleRegenerateCancel}>Cancel</button>
                <button className="primary-button" type="button" onClick={handleRegenerateConfirm}>Continue</button>
              </div>
            </div>
          </div>
        )}

      <div className="diagnostics-toggle">
        <button className="quiet-button compact-button" type="button" onClick={() => setShowDiagnostics((value) => !value)}>
          <ListChecks size={16} />
          {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
        </button>
      </div>

      {showDiagnostics && (
        <>
      <section className="score-grid">
        {analysis.cards.map((card) => (
          <article className="score-card" key={card.label}>
            <div className={`mini-score ${statusClass(card.score)}`}>{card.score}</div>
            <h3>{card.label}</h3>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel gate-panel">
        <div className="panel-title">
          <ShieldCheck size={18} />
          <h2>Submission Gates</h2>
        </div>
        <div className="gate-grid">
          {analysis.gates.map((gate) => (
            <article className={`gate-card ${gate.passed ? "pass" : "watch"}`} key={gate.label}>
              <div className={`mini-score ${statusClass(gate.score)}`}>{gate.score}</div>
              <div>
                <h3>{gate.label}</h3>
                <p>
                  Target {gate.target}+ - {gate.detail}
                </p>
              </div>
              {gate.passed ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            </article>
          ))}
        </div>
      </section>

      <section className="panel blueprint-panel">
        <div className="panel-title">
          <ClipboardList size={18} />
          <h2>Role Fit Blueprint</h2>
        </div>
        <div className="blueprint-summary">
          <div>
            <span>Target Role</span>
            <h3>{analysis.roleBlueprint.targetRole}</h3>
          </div>
          <p>{analysis.roleBlueprint.roleThesis}</p>
        </div>
        <div className="blueprint-grid">
          {analysis.roleBlueprint.proofPillars.map((pillar) => (
            <article className={`pillar-card ${pillar.status}`} key={pillar.label}>
              <div className={`mini-score ${statusClass(pillar.score)}`}>{pillar.score}</div>
              <div>
                <span>{pillar.status}</span>
                <h3>{pillar.label}</h3>
                <p>{pillar.jdNeed}</p>
                <small>{pillar.resumeProof}</small>
              </div>
            </article>
          ))}
        </div>
        <div className="blueprint-bottom">
          <div>
            <h3>Rewrite Strategy</h3>
            <ul className="fix-list">
              {analysis.roleBlueprint.rewriteStrategy.slice(0, 5).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>ATS Focus</h3>
            <div className="chips compact">
              {analysis.roleBlueprint.atsFocus.slice(0, 12).map((term) => (
                <span className="chip missing" key={term}>
                  {displayKeywordTerm(term)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="report-grid">
        <article className="panel">
          <div className="panel-title">
            <ListChecks size={18} />
            <h2>Top Fixes</h2>
          </div>
          <div className="issue-list">
            {analysis.issues.map((issue) => (
              <div className={`issue ${issue.severity}`} key={issue.title}>
                {issue.severity === "good" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <div>
                  <h3>{issue.title}</h3>
                  <p>{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <ShieldCheck size={18} />
            <h2>Keyword Map</h2>
          </div>
          <div className="keyword-block">
            <h3>Matched</h3>
            <div className="chips">
              {analysis.matchedKeywords.slice(0, 24).map((keyword) => (
                <span className="chip good" key={keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          <div className="keyword-block">
            <h3>Missing</h3>
            <div className="chips">
              {analysis.missingKeywords.slice(0, 24).map((keyword) => (
                <span className="chip missing" key={keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="panel evidence-panel">
        <div className="panel-title">
          <BookOpen size={18} />
          <h2>JD Evidence Map</h2>
        </div>
        <div className="evidence-grid">
          {analysis.targetingSignals.map((signal, index) => (
            <article className={`evidence-card ${signal.status}`} key={`${signal.category}-${signal.label}-${index}`}>
              <div>
                <span>{signal.category}</span>
                <h3>{signal.label}</h3>
              </div>
              <p>{signal.evidence}</p>
              <div className="chips compact">
                {signal.terms.slice(0, 4).map((term) => (
                  <span className={signal.status === "missing" ? "chip missing" : "chip good"} key={term}>
                    {displayKeywordTerm(term)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel pro-panel">
        <div className="panel-title">
          <ShieldCheck size={18} />
          <h2>Premium Scanner Modules</h2>
        </div>
        <div className="pro-grid">
          {analysis.proChecks.map((check) => (
            <article className="pro-check" key={check.label}>
              <div className={`mini-score ${statusClass(check.score)}`}>{check.score}</div>
              <div>
                <h3>{check.label}</h3>
                <p>{check.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel pro-roadmap-panel">
        <div className="panel-title">
          <Unlock size={18} />
          <h2>Pro Feature Map</h2>
        </div>
        <div className="promise-grid">
          {proFeatureMap.map((feature) => (
            <article className="promise-item" key={feature.title}>
              <div className={`mini-score ${statusClass(feature.score)}`}>{feature.score}</div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
        </>
      )}

      {showDiagnostics && (
      <section className="assist-grid">
        <article className="panel bullet-bank-panel">
          <div className="panel-title">
            <Library size={18} />
            <h2>Sample Bullet Bank</h2>
          </div>
          <div className="bank-meter">
            <strong>{sampleBulletBank.length}</strong>
            <span>cross-domain patterns</span>
          </div>
          <div className="sample-list">
            {recommendedBullets.map((sample, index) => (
              <div className="sample-bullet" key={`${sample.bullet}-${index}`}>
                <div>
                  <h3>{sample.category}</h3>
                  <span>{sample.role}</span>
                </div>
                <p>{sample.bullet}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
      )}

      {showDiagnostics && (
        <>
      <section className="panel template-panel">
        <div className="panel-title">
          <LayoutTemplate size={18} />
          <h2>ATS Template Library</h2>
        </div>
        <div className="template-grid">
          {templateOptions.map((template) => (
            <article className="template-option" key={template.name}>
              <div>
                <h3>{template.name}</h3>
                <span>{template.fit}</span>
              </div>
              <p>{template.strengths.join(" / ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel deep-review">
        <div className="panel-title">
          <Wand2 size={18} />
          <h2>Line-by-Line Bullet Review</h2>
        </div>
        <div className="bullet-list">
          {analysis.bulletReviews.map((review, index) => (
            <article className="bullet-review" key={`${review.text}-${index}`}>
              <div className={`bullet-score ${statusClass(review.score)}`}>{review.score}</div>
              <div>
                <div className="bullet-heading">
                  <h3>{review.verdict}</h3>
                  <span>Bullet {index + 1}</span>
                </div>
                <p className="bullet-text">{review.text}</p>
                {review.fixes.length > 0 && (
                  <ul className="fix-list">
                    {review.fixes.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ul>
                )}
                <div className="rewrite-box">
                  <strong>Rewrite pattern</strong>
                  <p>{review.rewrite}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel history-panel">
        <div className="panel-title">
          <History size={18} />
          <h2>Local Scan History</h2>
        </div>
        {savedScans.length === 0 ? (
          <p className="empty-state">No saved scans yet. Save a scan to compare tailored versions locally.</p>
        ) : (
          <div className="history-list">
            {savedScans.map((scan) => (
              <button className="history-item" type="button" key={scan.id} onClick={() => loadScan(scan)}>
                <span>{scan.title}</span>
                <strong>{scan.score}</strong>
                <small>
                  Projected {scan.projected} - {new Date(scan.createdAt).toLocaleString()}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>
        </>
      )}
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

