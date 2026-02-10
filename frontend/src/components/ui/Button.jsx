import { ArrowRight, Loader2 } from "lucide-react";

const Button = ({
  children,
  loading,
  variant = "primary", // 'primary', 'secondary', 'outline', 'ghost', 'danger'
  size = "md", // 'xs', 'sm', 'md', 'lg', 'xl'
  icon: Icon, // Optional icon to render
  className = "",
  disabled,
  fullWidth = false,
  isIconOnly = false,
  ...props
}) => {
  // 1. Base Styles
  // Enhanced with better accessibility and responsive behavior
  const baseStyles =
    "relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:pointer-events-none active:scale-95 rounded-xl whitespace-nowrap";

  // 2. Responsive Size Variants
  // Padding-based sizing for flexible content, responsive text sizes
  const sizes = {
    xs: "px-3 py-2 text-xs sm:text-xs gap-1",
    sm: "px-4 py-2.5 text-xs sm:text-sm gap-1.5",
    md: "px-6 py-3 text-sm sm:text-base gap-2",
    lg: "px-8 py-3.5 text-base sm:text-lg gap-2.5",
    xl: "px-10 py-4 text-base sm:text-lg gap-3",
  };

  // 3. Icon sizes (responsive)
  const iconSizes = {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
    xl: 22,
  };

  // 4. Visual Variants
  const variants = {
    // Primary: Subtle gradient, 1px border for depth, cleaner shadow
    primary:
      "bg-linear-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 border border-teal-400/20",

    // Secondary: Neutral dark surface with subtle border
    secondary:
      "bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700",

    // Outline: Transparent with visible border
    outline:
      "bg-transparent border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50",

    // Ghost: Minimalist, used for low-priority actions
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50",

    // Danger: Error states
    danger:
      "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30",
  };

  // 5. Width Classes
  const widthClass = fullWidth ? "w-full" : "inline-flex";
  const iconOnlyPadding = isIconOnly ? "p-0" : "";

  return (
    <button
      disabled={loading || disabled}
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${widthClass} ${iconOnlyPadding} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 sm:w-5 sm:h-5 animate-spin" />
      ) : (
        <>
          {Icon && (
            <Icon
              size={iconSizes[size]}
              className={children ? "shrink-0" : ""}
            />
          )}
          {children && <span className="shrink-0">{children}</span>}
          {variant === "primary" && children && (
            <ArrowRight
              size={iconSizes[size] - 2}
              className="opacity-70 hover:opacity-100 transition-all shrink-0"
            />
          )}
        </>
      )}
    </button>
  );
};

export default Button;
