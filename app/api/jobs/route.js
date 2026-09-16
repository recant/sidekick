import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SOURCES = 12;
const MAX_JOBS_PER_SOURCE = 80;

const PROVIDERS = {
  ashby: async ({ slug, company }) => {
    const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Ashby returned ${response.status}`);
    const data = await response.json();
    return (data.jobs || []).filter((job) => job.isListed !== false).slice(0, MAX_JOBS_PER_SOURCE).map((job) => ({
      id: `ashby:${slug}:${job.id}`,
      company,
      provider: 'Ashby',
      title: job.title || 'Untitled role',
      location: job.location || (job.isRemote ? 'Remote' : 'Unknown'),
      url: job.jobUrl || job.applyUrl,
      publishedAt: job.publishedAt || null,
      description: job.descriptionPlain || stripHtml(job.descriptionHtml || ''),
      employmentType: job.employmentType || null
    }));
  },
  lever: async ({ slug, company }) => {
    const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Lever returned ${response.status}`);
    const data = await response.json();
    return (Array.isArray(data) ? data : []).slice(0, MAX_JOBS_PER_SOURCE).map((job) => ({
      id: `lever:${slug}:${job.id}`,
      company,
      provider: 'Lever',
      title: job.text || 'Untitled role',
      location: job.categories?.location || 'Unknown',
      url: job.hostedUrl || job.applyUrl,
      publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      description: [job.descriptionPlain, ...(job.lists || []).map((item) => `${item.text || ''} ${stripHtml(item.content || '')}`)].filter(Boolean).join('\n'),
      employmentType: job.categories?.commitment || null
    }));
  },
  greenhouse: async ({ slug, company }) => {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Greenhouse returned ${response.status}`);
    const data = await response.json();
    return (data.jobs || []).slice(0, MAX_JOBS_PER_SOURCE).map((job) => ({
      id: `greenhouse:${slug}:${job.id}`,
      company,
      provider: 'Greenhouse',
      title: job.title || 'Untitled role',
      location: job.location?.name || 'Unknown',
      url: job.absolute_url,
      publishedAt: job.updated_at || null,
      description: stripHtml(job.content || ''),
      employmentType: null
    }));
  }
};

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferOpportunity(job) {
  const haystack = `${job.title}\n${job.description}`.toLowerCase();
  const title = job.title.toLowerCase();
  const categories = [
    { label: 'AI agent / LLM system', goal: 'Ship a defined AI workflow, agent, RAG system, or evaluation harness.', keywords: ['llm', 'large language', 'rag', 'agentic', 'ai agent', 'prompt', 'generative ai', 'evaluation', 'evals'], base: 86 },
    { label: 'Bioinformatics / analysis automation', goal: 'Automate a scientific analysis pipeline, QC workflow, or recurring report.', keywords: ['bioinformatics', 'computational biology', 'rna-seq', 'rnaseq', 'single-cell', 'single cell', 'genomics', 'transcriptomics', 'proteomics'], base: 84 },
    { label: 'Data pipeline / analytics', goal: 'Build or repair a concrete data pipeline, warehouse integration, or analytics workflow.', keywords: ['data engineer', 'etl', 'data pipeline', 'dbt', 'snowflake', 'warehouse', 'analytics engineer', 'data platform'], base: 78 },
    { label: 'Automation / internal tooling', goal: 'Replace a repetitive internal workflow with software or an integration.', keywords: ['automation', 'internal tool', 'workflow', 'integrations', 'operations platform', 'business systems'], base: 76 },
    { label: 'Product engineering sprint', goal: 'Deliver a tightly scoped product feature, prototype, dashboard, or integration.', keywords: ['full stack', 'full-stack', 'frontend', 'backend', 'product engineer', 'software engineer', 'mobile engineer'], base: 70 },
    { label: 'Growth / outbound system', goal: 'Build a lead-generation, sales-ops, lifecycle, or growth experiment system.', keywords: ['growth', 'sales operations', 'revenue operations', 'revops', 'demand generation', 'sales development'], base: 65 },
    { label: 'Design sprint', goal: 'Complete a defined redesign, design system, prototype, or launch asset package.', keywords: ['product designer', 'visual designer', 'design systems', 'ux designer', 'ui designer'], base: 58 }
  ];

  let best = { label: 'General project opportunity', goal: 'Ask what immediate deliverable is driving this hire and offer to own that outcome.', base: 48, matches: [] };
  for (const category of categories) {
    const matches = category.keywords.filter((keyword) => haystack.includes(keyword));
    if (matches.length && category.base + Math.min(matches.length * 2, 8) > best.base) best = { ...category, matches };
  }

  let score = best.base;
  const reasons = [];
  const deliveryHits = ['build', 'implement', 'launch', 'prototype', 'automate', 'integrate', 'deploy', 'migrate', 'redesign'].filter((word) => haystack.includes(word));
  if (deliveryHits.length >= 2) { score += 7; reasons.push('Description names concrete build/delivery work.'); }
  if (/contract|temporary|consultant|freelance/.test(`${title} ${job.employmentType || ''}`.toLowerCase())) { score += 8; reasons.push('Role already signals project/contract flexibility.'); }
  if (/staff|principal|director|head of|vp |vice president|manager/.test(title)) { score -= 16; reasons.push('Senior/leadership scope is less likely to collapse into one project.'); }
  if (/manage a team|people manager|hire and manage|organizational strategy|company-wide strategy/.test(haystack)) { score -= 10; reasons.push('Role includes durable organizational ownership, not just deliverables.'); }
  if (/0 to 1|zero to one|from scratch|greenfield|mvp|proof of concept|poc/.test(haystack)) { score += 7; reasons.push('Greenfield or prototype language suggests a discrete sprint.'); }
  if (best.matches?.length) reasons.unshift(`Strong signal: ${best.matches.slice(0, 3).join(', ')}.`);

  score = Math.max(20, Math.min(98, Math.round(score)));
  return {
    opportunityType: best.label,
    inferredGoal: best.goal,
    outsourceScore: score,
    reasons: reasons.slice(0, 3),
    suggestedQuestion: `I saw you're hiring for ${job.title}. Is the immediate need a specific deliverable that has to ship soon, or mainly long-term team capacity?`
  };
}

function validateSource(source) {
  if (!source || typeof source !== 'object') return null;
  const provider = String(source.provider || '').toLowerCase();
  const slug = String(source.slug || '').trim();
  const company = String(source.company || slug).trim();
  if (!PROVIDERS[provider] || !/^[a-zA-Z0-9._-]{1,80}$/.test(slug) || !company) return null;
  return { provider, slug, company: company.slice(0, 100) };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sources = (Array.isArray(body.sources) ? body.sources : []).slice(0, MAX_SOURCES).map(validateSource).filter(Boolean);
    if (!sources.length) return NextResponse.json({ jobs: [], errors: ['Add at least one valid public ATS source.'] }, { status: 400 });

    const settled = await Promise.allSettled(sources.map(async (source) => {
      const jobs = await PROVIDERS[source.provider](source);
      return jobs.map((job) => ({ ...job, ...inferOpportunity(job) }));
    }));

    const jobs = [];
    const errors = [];
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') jobs.push(...result.value);
      else errors.push(`${sources[index].company}: ${result.reason?.message || 'Failed to load jobs'}`);
    });
    jobs.sort((a, b) => b.outsourceScore - a.outsourceScore || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    return NextResponse.json({ jobs, errors, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ jobs: [], errors: [error?.message || 'Unexpected server error'] }, { status: 500 });
  }
}
