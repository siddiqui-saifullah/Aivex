/**
 * Application options and choices
 */

export const TECH_STACKS = ['HTML/CSS/JS', 'React', 'Next.js', 'Node.js'] as const;

export type TechStack = (typeof TECH_STACKS)[number];

export const PROJECT_STATES = {
    LOADING: 'loading',
    EMPTY: 'empty',
    ERROR: 'error',
    SUCCESS: 'success',
} as const;

export type ProjectListState = (typeof PROJECT_STATES)[keyof typeof PROJECT_STATES];

export const STACK_FORMATTER: Record<string, string> = {
    'react': 'React',
    'nodejs': 'Node.js',
    'nextjs': 'Next.js',
    'htmlcssjs': 'HTML/CSS/JS',
};
