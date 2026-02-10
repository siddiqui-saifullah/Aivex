/**
 * Hook for consistent date formatting across the app
 */
export const useFormatDate = () => {
    const formatDate = (dateString) => {
        if (!dateString) return '—';

        let date;
        if (dateString instanceof Date) {
            date = dateString;
        } else if (typeof dateString === 'number') {
            date = new Date(dateString);
        } else {
            const maybeNumber = Number(dateString);
            date = Number.isNaN(maybeNumber) ? new Date(dateString) : new Date(maybeNumber);
        }

        if (isNaN(date.getTime())) return '—';

        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return { formatDate };
};
