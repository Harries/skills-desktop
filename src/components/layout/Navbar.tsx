import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Boxes, ShoppingBag, Settings, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

function Navbar() {
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    // Initialize theme from system preference or local storage
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        }
    }, []);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const navItems = [
        { path: '/my-skills', label: t('mySkills'), icon: Boxes },
        { path: '/marketplace', label: t('marketplace'), icon: ShoppingBag },
        { path: '/settings', label: t('settings'), icon: Settings },
    ];

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    };

    const [langOpen, setLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(e.target as Node)) {
                setLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

    return (
        <nav
            style={{ position: 'sticky', top: 0, zIndex: 50 }}
            className="pt-4 transition-all duration-200 bg-[#FAFBFC] dark:bg-base-300 border-b border-transparent"
        >
            <div className="max-w-7xl mx-auto px-4 md:px-8 relative" style={{ zIndex: 10 }}>
                <div className="flex items-center justify-between h-16">
                    {/* Logo - Left */}
                    <div className="flex items-center">
                        <Link to="/my-skills" className="text-xl font-bold text-gray-900 dark:text-base-content flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                                S
                            </div>
                            <span>Skills Desktop</span>
                        </Link>
                    </div>

                    {/* Pill Navigation - Center (Hidden on small screens) */}
                    <div className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-base-200 rounded-full p-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-4 lg:px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isActive(item.path)
                                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-base-content dark:hover:bg-base-100'
                                    }`}
                            >
                                <item.icon size={16} />
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Language Selector */}
                        <div className="relative" ref={langRef}>
                            <button
                                onClick={() => setLangOpen(!langOpen)}
                                className="h-10 px-3 rounded-full bg-gray-100 dark:bg-base-200 hover:bg-gray-200 dark:hover:bg-base-100 flex items-center gap-1.5 transition-colors"
                            >
                                <span className="text-sm">{currentLang.flag}</span>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">{currentLang.label}</span>
                                <ChevronDown size={12} className={`text-gray-500 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {langOpen && (
                                <div className="absolute right-0 top-12 w-44 bg-white dark:bg-base-200 rounded-xl shadow-lg border border-gray-200 dark:border-base-300 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.code}
                                            onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                                            className={`w-full px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
                                                i18n.language === lang.code
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-base-100'
                                            }`}
                                        >
                                            <span className="text-base">{lang.flag}</span>
                                            <span>{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-base-200 hover:bg-gray-200 dark:hover:bg-base-100 flex items-center justify-center transition-colors"
                            title={theme === 'light' ? t('dark') : t('light')}
                        >
                            {theme === 'light' ? (
                                <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            ) : (
                                <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {/* Mobile Navigation (Simple fallback) */}
            <div className="md:hidden flex overflow-x-auto p-2 gap-2 border-t border-base-200 hide-scrollbar">
                 {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex-none px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${isActive(item.path)
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-gray-100 text-gray-700 dark:bg-base-200 dark:text-gray-400'
                            }`}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
}

export default Navbar;
