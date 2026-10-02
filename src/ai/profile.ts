export const PROFESSIONAL_PROFILE = {
  role: 'Full-Stack Developer focused on AI Automation',
  englishLevel: 'B1',
  technologies: [
    'TypeScript', 'JavaScript', 'React', 'Next.js', 'Node.js', 'NestJS',
    'Python', 'FastAPI', 'PostgreSQL', 'Supabase', 'REST APIs', 'webhooks',
    'Docker', 'OpenAI and LLM APIs', 'RAG', 'AI agents', 'workflow automation',
    'Playwright scraping',
  ],
  preferredWork: [
    'AI automation', 'AI engineering', 'Python automation', 'API integrations',
    'LLM integrations', 'internal tools', 'scraping', 'monitoring systems',
    'full-stack projects', 'backend automation',
  ],
  avoidOrPenalize: [
    'mandatory C1/C2 English', 'senior roles requiring many verifiable years',
    'pure design work', 'pure WordPress work', 'extremely low pay',
    'technologies far outside the profile',
  ],
  projects: [
    {
      name: 'Perfume Monitoring Platform',
      details: 'Multi-store Playwright scraping, scheduled jobs, normalization, stock and price change detection, independent failures, retries, notifications, APIs and database.',
    },
    {
      name: 'DevMind',
      details: 'Knowledge system over about 500 study documents using RAG, embeddings, vector database, retrieval, LLM, Ask mode and Guide mode.',
    },
    {
      name: 'Full-stack projects',
      details: 'Next.js, NestJS, authentication, databases, APIs, Stripe, Supabase and React.',
    },
  ],
} as const;
