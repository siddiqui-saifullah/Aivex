import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`absolute top-6 right-6 z-50 p-2 rounded-full transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-white/5 hover:bg-white/10 text-teal-400 border border-white/10'
          : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200 shadow-sm'
      }`}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}

export default ThemeToggle;
