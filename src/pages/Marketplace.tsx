import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Download, Search, Star, ExternalLink, Check, Loader2, Shield, ShieldCheck, ShieldAlert, X, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react';
import { getLocalizedDescription } from '../utils/i18n';
import { invoke } from '@tauri-apps/api/core';

interface SecurityReport {
  skillId: string;
  score: number;
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  issues: any[];
  blocked: boolean;
  recommendations: string[];
  scannedFiles: string[];
}

type InstallPhase = 'idle' | 'downloading' | 'installing' | 'scanning' | 'done';

interface InstallStatus {
  show: boolean;
  phase: InstallPhase;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  securityReport?: SecurityReport;
}

const Marketplace = () => {
  const { t, i18n } = useTranslation();
  const {
    marketplaceSkills,
    marketplaceTotal,
    fetchMarketplaceSkills,
    installSkill,
    installedSkills,
    isLoading
  } = useSkillStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [isBatchInstalling, setIsBatchInstalling] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedSkills, setBatchSelectedSkills] = useState<string[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallStatus>({
    show: false,
    phase: 'idle',
    message: '',
    type: 'info'
  });
  const pageSize = 20;  // Match API limit
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch skills from API on mount
  useEffect(() => {
    console.log('[Marketplace Component] Mounted, calling fetchMarketplaceSkills...');
    fetchMarketplaceSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search - call API when search term changes
  const handleSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      console.log('[Marketplace] Searching for:', query);
      setPage(1);  // Reset to first page on new search
      fetchMarketplaceSkills(query, 1);
    }, 300);  // 300ms debounce
  }, [fetchMarketplaceSkills]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    fetchMarketplaceSkills(searchTerm, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchMarketplaceSkills, searchTerm]);

  const toggleBatchSelect = (skillId: string) => {
    setBatchSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const clearBatchSelect = () => {
    setBatchSelectedSkills([]);
  };

  const selectAllBatch = (skillIds: string[]) => {
    setBatchSelectedSkills(skillIds);
  };

  const getPhaseMessage = (phase: InstallPhase, skillName: string): string => {
    const messages: Record<InstallPhase, string> = {
      downloading: t('downloadingSkill', { name: skillName }),
      installing: t('installingSkill', { name: skillName }),
      scanning: t('runningSecurityScan'),
      done: t('installComplete', { name: skillName }),
      idle: ''
    };
    return messages[phase];
  };

  const handleInstall = async (skill: any) => {
    if (installingSkillId) return;

    setInstallingSkillId(skill.id);

    setInstallStatus({
      show: true,
      phase: 'downloading',
      message: getPhaseMessage('downloading', skill.name),
      type: 'info'
    });

    try {
      setTimeout(() => {
        setInstallStatus(prev => ({
          ...prev,
          phase: 'installing',
          message: getPhaseMessage('installing', skill.name)
        }));
      }, 500);

      const result = await installSkill(skill);

      setInstallStatus(prev => ({
        ...prev,
        phase: 'scanning',
        message: getPhaseMessage('scanning', skill.name)
      }));

      await new Promise(resolve => setTimeout(resolve, 500));

      if (result.securityReport) {
        const report = result.securityReport;
        const isRisky = report.level === 'high' || report.level === 'critical' || report.blocked;

        setInstallStatus({
          show: true,
          phase: 'done',
          message: isRisky
            ? t('installRisk', { name: skill.name })
            : t('installScore', { name: skill.name, score: report.score }),
          type: isRisky ? 'warning' : 'success',
          securityReport: report
        });
      } else {
        setInstallStatus({
          show: true,
          phase: 'done',
          message: getPhaseMessage('done', skill.name),
          type: 'success'
        });
      }

      if (!result.securityReport?.blocked && result.securityReport?.level !== 'critical') {
        setTimeout(() => {
          setInstallStatus(prev => {
            if (prev.phase === 'done' && !prev.securityReport?.blocked) {
              return { show: false, phase: 'idle', message: '', type: 'info' };
            }
            return prev;
          });
        }, 5000);
      }

    } catch (error: any) {
      console.error('Installation error:', error);
      const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error');
      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('installFailed', { message: errorMessage }),
        type: 'error'
      });
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } finally {
      setInstallingSkillId(null);
    }
  };

  const handleBatchInstall = async () => {
    if (batchSelectedSkills.length === 0 || isBatchInstalling) return;

    const skillsToInstall = marketplaceSkills.filter(s => batchSelectedSkills.includes(s.id));
    if (skillsToInstall.length === 0) return;

    setIsBatchInstalling(true);
    setInstallStatus({
      show: true,
      phase: 'installing',
      message: t('batchInstalling', { count: skillsToInstall.length }),
      type: 'info'
    });

    let successCount = 0;
    let failCount = 0;

    try {
      for (const skill of skillsToInstall) {
        try {
          await installSkill(skill);
          successCount++;
        } catch (e) {
          failCount++;
          console.error(`Failed to install ${skill.name}:`, e);
        }
      }

      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('batchInstallComplete', { success: successCount }) + (failCount > 0 ? t('nFailed', { count: failCount }) : ''),
        type: failCount > 0 ? 'warning' : 'success'
      });

      setBatchMode(false);
      clearBatchSelect();
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } catch (error: any) {
      console.error('Batch installation error:', error);
      setInstallStatus({
        show: true,
        phase: 'done',
        message: t('batchInstallFailed', { message: error.message }),
        type: 'error'
      });
      setTimeout(() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' }), 5000);
    } finally {
      setIsBatchInstalling(false);
    }
  };

  const handleOpenSource = async (url: string) => {
    try {
        await invoke('open_url', { url });
    } catch (error) {
        console.error('Failed to open URL:', error);
        alert(t('failedOpenUrl', { error }));
    }
  };

  const isInstalled = (skill: any) => {
    // Check by ID, name, or GitHub URL since installed skills use path as ID
    return installedSkills.some(s => 
      s.id === skill.id || 
      s.name === skill.name ||
      (skill.githubUrl && s.sourceUrl && s.sourceUrl.includes(skill.githubUrl.replace('https://github.com/', '').replace('.git', '')))
    );
  };

  // Use skills directly from API (already filtered and paginated)
  const currentSkills = marketplaceSkills;
  const totalPages = Math.ceil(marketplaceTotal / pageSize);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);

      if (end - start < maxVisiblePages - 1) {
        if (start === 1) {
          end = Math.min(totalPages, start + maxVisiblePages - 1);
        } else {
          start = Math.max(1, end - maxVisiblePages + 1);
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const getSecurityIcon = (level: string) => {
    switch (level) {
      case 'safe':
      case 'low':
        return <ShieldCheck className="text-success" size={20} />;
      case 'medium':
        return <Shield className="text-warning" size={20} />;
      case 'high':
      case 'critical':
        return <ShieldAlert className="text-error" size={20} />;
      default:
        return <Shield className="text-info" size={20} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="space-y-8">
      {/* Install Status Toast */}
      {installStatus.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert shadow-2xl max-w-md rounded-2xl border ${
            installStatus.type === 'success' ? 'alert-success border-success/30' :
            installStatus.type === 'warning' ? 'alert-warning border-warning/30' :
            installStatus.type === 'error' ? 'alert-error border-error/30' : 'alert-info border-info/30'
          }`}>
            <div className="flex items-start gap-3 w-full">
              {installStatus.phase !== 'done' ? (
                <Loader2 className="animate-spin flex-shrink-0 mt-0.5" size={18} />
              ) : installStatus.securityReport ? (
                getSecurityIcon(installStatus.securityReport.level)
              ) : installStatus.type === 'success' ? (
                <Check size={18} className="flex-shrink-0 mt-0.5" />
              ) : null}

              <div className="flex-1 min-w-0">
                <p className="font-semibold">{installStatus.message}</p>

                {installStatus.securityReport && installStatus.phase === 'done' && (
                  <div className="mt-2 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{t('securityScoreLabel')}</span>
                      <span className={`font-bold ${getScoreColor(installStatus.securityReport.score)}`}>
                        {installStatus.securityReport.score}/100
                      </span>
                    </div>
                    {installStatus.securityReport.issues.length > 0 && (
                      <p className="opacity-80">
                        {t('potentialIssues', { count: installStatus.securityReport.issues.length })}
                      </p>
                    )}
                    {installStatus.securityReport.blocked && (
                      <p className="text-error font-medium mt-1">
                        {t('criticalRisk')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {installStatus.phase === 'done' && (
                <button
                  onClick={() => setInstallStatus({ show: false, phase: 'idle', message: '', type: 'info' })}
                  className="btn btn-ghost btn-xs btn-circle flex-shrink-0 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-violet-500 rounded-xl">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold">{t('marketplace')}</h2>
          </div>
          <p className="text-base-content/60 text-lg">
            {t('discoverSkills')}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="stat-badge bg-primary/10 text-primary">
              {marketplaceTotal} {t('skillsCount')}
            </span>
            <span className="stat-badge bg-success/10 text-success">
              {installedSkills.length} {t('installed')}
            </span>
            <span className="stat-badge bg-orange-500/10 text-orange-500">
              Claude Code
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Batch Mode Toggle */}
          <button
            className={`btn btn-sm gap-2 rounded-xl transition-all duration-200 ${
              batchMode
                ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25'
                : 'bg-base-200 hover:bg-base-300 border-0'
            }`}
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) clearBatchSelect();
            }}
          >
            {batchMode ? <CheckSquare size={14} /> : <Square size={14} />}
            {t('batchMode')}
          </button>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              className="input bg-base-200 border-0 pl-10 w-full md:w-64 rounded-xl focus:ring-2 focus:ring-primary/20"
              placeholder={t('searchSkills')}
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                handleSearch(value);
              }}
            />
          </div>
        </div>
      </div>

      {/* Batch Action Bar */}
      {batchMode && (
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-violet-500/10 p-4 rounded-2xl border border-primary/20 animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              className="btn btn-xs btn-ghost rounded-lg hover:bg-white/10"
              onClick={() => {
                const uninstalledIds = currentSkills
                  .filter(s => !isInstalled(s))
                  .map(s => s.id);
                selectAllBatch(uninstalledIds);
              }}
            >
              {t('selectAllPage')}
            </button>
            <button
              className="btn btn-xs btn-ghost rounded-lg hover:bg-white/10"
              onClick={clearBatchSelect}
            >
              {t('clearSelection')}
            </button>
            <span className="text-sm font-medium text-base-content/70">
              {t('nSelected', { count: batchSelectedSkills.length })}
            </span>
          </div>
          <button
            className="btn btn-primary btn-sm gap-2 rounded-xl shadow-lg shadow-primary/25"
            onClick={handleBatchInstall}
            disabled={batchSelectedSkills.length === 0 || isBatchInstalling}
          >
            {isBatchInstalling ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {t('installingText')}
              </>
            ) : (
              <>
                <Download size={16} />
                {t('installNToClaude', { count: batchSelectedSkills.length })}
              </>
            )}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">{t('loadingSkills')}</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Skills Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {currentSkills.map((skill, index) => {
              const installed = isInstalled(skill);
              const isCurrentlyInstalling = installingSkillId === skill.id;
              const isSelected = batchSelectedSkills.includes(skill.id);
              return (
                <div
                  key={skill.id}
                  className={`skill-card h-full flex flex-col cursor-pointer animate-slide-up ${
                    batchMode && isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-100' : ''
                  } ${installed ? 'opacity-75' : ''}`}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => {
                    if (batchMode && !installed) {
                      toggleBatchSelect(skill.id);
                    }
                  }}
                >
                  <div className="card-body p-5 flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {batchMode && !installed && (
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary rounded-lg"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleBatchSelect(skill.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {skill.authorAvatar ? (
                          <img src={skill.authorAvatar} alt={skill.author} className="w-7 h-7 rounded-full ring-2 ring-base-200" />
                        ) : (
                          <div className="w-7 h-7 rounded-full ring-2 ring-base-200 bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {skill.author?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="text-sm text-base-content/60 font-medium">{skill.author}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-500 text-sm font-semibold bg-amber-500/10 px-2 py-1 rounded-lg">
                        <Star size={12} fill="currentColor" />
                        <span>{skill.stars.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold mb-2 line-clamp-1">{skill.name}</h3>

                    {/* Description */}
                    <p className="text-sm text-base-content/60 line-clamp-3 mb-4 flex-1 leading-relaxed" title={getLocalizedDescription(skill, i18n.language)}>
                      {getLocalizedDescription(skill, i18n.language)}
                    </p>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-base-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSource(skill.githubUrl);
                        }}
                        className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-base-content rounded-lg"
                      >
                        <ExternalLink size={14} />
                        {t('sourceCode')}
                      </button>

                      {installed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm font-medium">
                          <Check size={14} />
                          {t('installed')}
                        </span>
                      ) : batchMode ? (
                        <span className="text-xs text-base-content/50 font-medium">
                          {isSelected ? t('selectedText') : t('clickToSelect')}
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm gap-2 rounded-lg shadow-lg shadow-primary/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstall(skill);
                          }}
                          disabled={!!installingSkillId}
                        >
                          {isCurrentlyInstalling ? (
                            <>
                              <span className="loading loading-spinner loading-xs"></span>
                              {installStatus.phase === 'scanning'
                                ? t('scanning')
                                : t('installing')}
                            </>
                          ) : (
                            <>
                              <Download size={14} />
                              {t('install')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10 pb-8">
              <div className="flex items-center gap-1 bg-base-200 p-1.5 rounded-2xl">
                <button
                  className="btn btn-sm btn-ghost rounded-xl"
                  disabled={page === 1 || isLoading}
                  onClick={() => handlePageChange(1)}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  className="btn btn-sm btn-ghost rounded-xl"
                  disabled={page === 1 || isLoading}
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1 px-2">
                  {getPageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`btn btn-sm min-w-[2.5rem] rounded-xl transition-all duration-200 ${
                        pageNum === page
                          ? 'btn-primary shadow-lg shadow-primary/25'
                          : 'btn-ghost'
                      }`}
                      disabled={isLoading}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  className="btn btn-sm btn-ghost rounded-xl"
                  disabled={page === totalPages || isLoading}
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="btn btn-sm btn-ghost rounded-xl"
                  disabled={page === totalPages || isLoading}
                  onClick={() => handlePageChange(totalPages)}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Marketplace;
