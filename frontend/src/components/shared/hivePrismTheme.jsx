export const hivePrismTheme = {
  'code[class*="language-"]': {
    color: '#e5e7eb',           // zinc-200
    background: '#0a0a0a',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.875rem',
  },
  'pre[class*="language-"]': {
    color: '#e5e7eb',
    background: '#0a0a0a',
  },

  /* Comments — subtle, non-distracting */
  comment: {
    color: '#71717a',           // zinc-500
    fontStyle: 'italic',
  },

  /* Keywords — PRIMARY brand color */
  keyword: {
    color: '#5eead4',           // teal-300
    fontWeight: 600,
  },

  /* Strings — slightly warm but muted */
  string: {
    color: '#86efac',           // green-300
  },

  /* Numbers / booleans */
  number: {
    color: '#fde68a',           // amber-200
  },
  boolean: {
    color: '#fde68a',
  },

  /* Functions — secondary accent */
  function: {
    color: '#22d3ee',           // cyan-400
  },

  /* Class names / types */
  'class-name': {
    color: '#67e8f9',           // cyan-300
  },

  /* Operators — neutral */
  operator: {
    color: '#e5e7eb',
  },

  /* Punctuation — de-emphasized */
  punctuation: {
    color: '#9ca3af',           // zinc-400
  },
};
