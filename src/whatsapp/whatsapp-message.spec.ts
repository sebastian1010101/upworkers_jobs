import { Job, JobAnalysis } from '@prisma/client';
import { buildJobAlertParameters } from './whatsapp-message';

describe('buildJobAlertParameters', () => {
  it('formats the seven approved-template parameters', () => {
    const job = {
      title: 'AI Automation Specialist',
      budgetType: 'FIXED',
      budgetMin: { toString: () => '300' },
      budgetMax: { toString: () => '500' },
      skills: ['Python', 'OpenAI', 'APIs'],
      url: 'https://example.com/job',
    } as unknown as Job;
    const analysis = {
      score: { toString: () => '8.7' },
      strengths: ['AI automation', 'Relevant monitoring project'],
      weaknesses: ['Client prefers Upwork history'],
    } as unknown as JobAnalysis;

    expect(buildJobAlertParameters(job, analysis)).toEqual([
      'AI Automation Specialist',
      '8.7',
      'USD 300–500',
      'Python, OpenAI, APIs',
      'AI automation; Relevant monitoring project',
      'Client prefers Upwork history',
      'https://example.com/job',
    ]);
  });

  it('supplies readable fallbacks for absent optional data', () => {
    const job = {
      title: 'Backend role',
      budgetType: 'UNKNOWN',
      skills: [],
      url: null,
    } as unknown as Job;
    const analysis = {
      score: { toString: () => '8' },
      strengths: [],
      weaknesses: [],
    } as unknown as JobAnalysis;

    expect(buildJobAlertParameters(job, analysis)).toEqual(expect.arrayContaining([
      'Not specified',
      'No specific strengths identified',
      'No major weakness identified',
      'URL unavailable in the API response',
    ]));
  });
});
