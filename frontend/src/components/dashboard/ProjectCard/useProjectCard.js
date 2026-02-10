import { useRef, useState } from 'react';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { useFormatDate } from '../../../hooks/useFormatDate';
import { STACK_FORMATTER } from '../../../constants/options';

// Hook for ProjectCard logic
export const useProjectCard = () => {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useClickOutside(menuRef, () => setShowMenu(false));
    const { formatDate } = useFormatDate();

    const formatStack = (stack) => {
        return STACK_FORMATTER[stack?.toLowerCase()] || stack;
    };

    return {
        showMenu,
        setShowMenu,
        menuRef,
        formatDate,
        formatStack
    };
};
