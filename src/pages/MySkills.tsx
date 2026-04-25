import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Trash2, Eye, FolderOpen, X, Github, HardDrive, Plus, ExternalLink, RefreshCw, AlertCircle, CheckCircle, Package, Calendar, Download, CheckSquare, Square, Search } from 'lucide-react';
import type { InstalledSkill } from '../types';
import { invoke } from '@tauri-apps/api/core';

const MySkills = () => {
  const { t, i18n } = useTranslation();
  const {
    installedSkills,
    scanLocalSkills,
    importFromGithub,
    importFromLocal,
    updateSelectedSkills,
    checkSkillUpdates,
    reinstallSkill,
    isCheckingUpdates,
    isUpdating
  } = useSkillStore();
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'project'>('all');
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [skillContent, setSkillContent] = useState<string>('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'github' | 'local' | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [importPath, setImportPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updateResult, setUpdateResult] = useState<{show: boolean, success: number, failed: number} | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);

  const handleUninstall = async (skill: InstalledSkill) => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const result: any = await invoke('uninstall_skill', {
        request: {
          skillPath: skill.localPath
        }
      });

      if (result.success) {
        setDeleteResult({show: true, success: true, message: `${skill.name} ${t('deletedSuccessfully')}`});
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(skill.id);
          return next;
        });
        await scanLocalSkills();
      } else {
        setDeleteResult({show: true, success: false, message: `${t('deleteFailed')}: ${result.message}`});
      }
    } catch (error: any) {
      const errMsg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
      setDeleteResult({show: true, success: false, message: `${t('deleteError')}: ${errMsg}`});
    } finally {
      setIsDeleting(false);
      setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (isDeleting || selectedIds.size === 0) return;

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const skill = installedSkills.find(s => s.id === id);
      if (!skill) continue;

      try {
        const result: any = await invoke('uninstall_skill', {
          request: { skillPath: skill.localPath }
        });
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setDeleteResult({
      show: true,
      success: failCount === 0,
      message: t('deleteComplete', { success: successCount, failed: failCount })
    });
    setSelectedIds(new Set());
    await scanLocalSkills();
    setIsDeleting(false);
    setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
  };

  // 单个更新
  const handleSingleUpdate = async (skillId: string) => {
    setUpdatingSkillId(skillId);
    try {
      await reinstallSkill(skillId);
      setDeleteResult({
        show: true,
        success: true,
        message: t('updateSuccessful')
      });
    } catch {
      setDeleteResult({
        show: true,
        success: false,
        message: t('updateFailed')
      });
    } finally {
      setUpdatingSkillId(null);
      setTimeout(() => setDeleteResult({show: false, success: false, message: ''}), 3000);
    }
  };

  useEffect(() => {
    scanLocalSkills();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSkills = installedSkills.filter(skill => {
    // Tab filter
    if (activeTab !== 'all' && skill.type !== activeTab) return false;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description?.toLowerCase().includes(q) ||
        skill.author?.toLowerCase().includes(q) ||
        skill.source?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleViewSkill = async (skill: InstalledSkill) => {
    setSelectedSkill(skill);
    setShowViewModal(true);

    try {
      const content = await invoke<string>('read_skill', {
        skillPath: skill.localPath
      });
      setSkillContent(content);
    } catch (error) {
      console.error('Failed to load skill content:', error);
      setSkillContent(`# ${skill.name}\n\n${skill.description}\n\n**${t('version')}**: ${skill.version}\n**${t('author')}**: ${skill.author}\n\n**Path**: ${skill.localPath}`);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      if (importType === 'github') {
        await importFromGithub(importUrl);
        alert(t('importGithubSuccess'));
      } else if (importType === 'local') {
        await importFromLocal(importPath);
        alert(t('importLocalSuccess'));
      }
      setShowImportModal(false);
      setImportUrl('');
      setImportPath('');
      setImportType(null);
    } catch (error: any) {
      alert(`${t('importFailed')}: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportType(null);
    setImportUrl('');
    setImportPath('');
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const localeMap: Record<string, string> = {
      en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR',
      es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', ar: 'ar-SA'
    };
    return date.toLocaleDateString(localeMap[i18n.language] || 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'marketplace':
        return <Package size={14} className="text-primary" />;
      case 'github':
        return <Github size={14} className="text-base-content/60" />;
      case 'local':
        return <HardDrive size={14} className="text-base-content/60" />;
      default:
        return <FolderOpen size={14} className="text-base-content/60" />;
    }
  };

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'marketplace':
        return t('marketplace');
      case 'github':
        return 'GitHub';
      case 'local':
        return t('local');
      default:
        return t('unknown');
    }
  };

  // 多选操作
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSkills.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSkills.map(s => s.id)));
    }
  };

  const handleBatchUpdate = async () => {
    const idsToUpdate = Array.from(selectedIds);
    const result = await updateSelectedSkills(idsToUpdate);
    setUpdateResult({
      show: true,
      success: result.success.length,
      failed: result.failed.length
    });
    setSelectedIds(new Set());
    setTimeout(() => setUpdateResult(null), 5000);
  };

  // 获取可更新的选中 Skills
  const updatableSelected = Array.from(selectedIds).filter(id => {
    const skill = installedSkills.find(s => s.id === id);
    return skill?.sourceUrl;
  });

  return (
    <div className="space-y-4">
      {/* Toast Notifications */}
      {deleteResult.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${deleteResult.success ? 'alert-success' : 'alert-error'} shadow-lg rounded-2xl`}>
            <span>{deleteResult.message}</span>
          </div>
        </div>
      )}

      {updateResult?.show && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-info shadow-lg rounded-2xl">
            <span>
              {t('updateComplete', { success: updateResult.success, failed: updateResult.failed })}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-violet-500 rounded-xl">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('mySkills')}</h2>
            <p className="text-sm text-base-content/60">
              {installedSkills.length} {t('installed')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search Bar - compact */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              placeholder={t('searchSkillPlaceholder')}
              className="input input-sm bg-base-200/50 border border-base-300 w-40 rounded-xl pl-8 pr-7 text-sm focus:outline-none focus:border-primary focus:w-56 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm gap-2 rounded-xl"
            onClick={() => checkSkillUpdates()}
            disabled={isCheckingUpdates}
          >
            {isCheckingUpdates ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <RefreshCw size={16} />
            )}
            {t('checkUpdates')}
          </button>
          <button
            className="btn btn-primary gap-2 rounded-xl shadow-lg shadow-primary/25"
            onClick={() => setShowImportModal(true)}
          >
            <Plus size={18} />
            {t('importSkill')}
          </button>
        </div>
      </div>

      {/* Tabs & Batch Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1 rounded-xl">
          <a
            role="tab"
            className={`tab rounded-lg text-sm ${activeTab === 'all' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            {t('all')} ({installedSkills.length})
          </a>
          <a
            role="tab"
            className={`tab rounded-lg text-sm ${activeTab === 'system' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            {t('systemLevel')} ({installedSkills.filter(s => s.type === 'system').length})
          </a>
          <a
            role="tab"
            className={`tab rounded-lg text-sm ${activeTab === 'project' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('project')}
          >
            {t('projectLevel')} ({installedSkills.filter(s => s.type === 'project').length})
          </a>
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60">
              {selectedIds.size} {t('selected')}
            </span>
            <button
              className="btn btn-sm btn-primary gap-2 rounded-lg"
              onClick={handleBatchUpdate}
              disabled={isUpdating || updatableSelected.length === 0}
            >
              {isUpdating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download size={14} />
              )}
              {t('batchUpdate')}
              {updatableSelected.length > 0 && ` (${updatableSelected.length})`}
            </button>
            <button
              className="btn btn-sm btn-error btn-outline gap-2 rounded-lg"
              onClick={handleBatchDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Trash2 size={14} />
              )}
              {t('batchDelete')}
            </button>
            <button
              className="btn btn-sm btn-ghost rounded-lg"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>

      {/* Skills List */}
      {filteredSkills.length > 0 ? (
        <div className="bg-base-200/50 rounded-2xl border border-base-300 overflow-hidden">
          {/* List Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-base-200/80 border-b border-base-300 text-xs font-semibold text-base-content/60 uppercase tracking-wider">
            <button
              className="shrink-0"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === filteredSkills.length ? (
                <CheckSquare size={16} className="text-primary" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <div className="flex-1 min-w-0">{t('name')}</div>
            <div className="w-24 text-center hidden sm:block">{t('source')}</div>
            <div className="w-24 text-center hidden md:block">{t('installedDate')}</div>
            <div className="w-20 text-center hidden lg:block">{t('status')}</div>
            <div className="w-40 text-right">{t('actions')}</div>
          </div>

          {/* List Items */}
          <div className="divide-y divide-base-300">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-base-200/50 transition-colors ${
                  selectedIds.has(skill.id) ? 'bg-primary/5' : ''
                }`}
              >
                {/* Checkbox */}
                <button
                  className="shrink-0"
                  onClick={() => toggleSelect(skill.id)}
                >
                  {selectedIds.has(skill.id) ? (
                    <CheckSquare size={16} className="text-primary" />
                  ) : (
                    <Square size={16} className="text-base-content/40" />
                  )}
                </button>

                {/* Name & Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{skill.name}</span>
                    {skill.version && (
                      <span className="badge badge-ghost badge-xs font-mono">v{skill.version}</span>
                    )}
                    {skill.type === 'system' ? (
                      <span className="badge badge-neutral badge-xs">{t('system')}</span>
                    ) : (
                      <span className="badge badge-accent badge-outline badge-xs">{t('project')}</span>
                    )}
                    {skill.hasUpdate && (
                      <span className="badge badge-warning badge-xs gap-0.5">
                        <RefreshCw size={8} />
                        {t('updateAvailable')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-base-content/50 truncate" title={skill.description}>
                    {skill.description}
                  </p>
                </div>

                {/* Source - Clickable */}
                <div className="w-24 hidden sm:flex items-center justify-center">
                  {skill.sourceUrl ? (
                    <button
                      className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                      onClick={() => invoke('open_url', { url: skill.sourceUrl })}
                      title={skill.sourceUrl}
                    >
                      {getSourceIcon(skill.source)}
                      <span>{getSourceLabel(skill.source)}</span>
                      <ExternalLink size={10} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      {getSourceIcon(skill.source)}
                      <span>{getSourceLabel(skill.source)}</span>
                    </div>
                  )}
                </div>

                {/* Install Date */}
                <div className="w-24 hidden md:flex items-center justify-center gap-1 text-xs text-base-content/50">
                  <Calendar size={12} />
                  <span>{formatDate(skill.installDate)}</span>
                </div>

                {/* Status */}
                <div className="w-20 hidden lg:flex justify-center">
                  {skill.status === 'safe' && (
                    <span className="badge badge-success badge-xs gap-0.5">
                      <CheckCircle size={10} />
                      {t('safe')}
                    </span>
                  )}
                  {skill.status === 'unsafe' && (
                    <span className="badge badge-error badge-xs gap-0.5">
                      <AlertCircle size={10} />
                      {t('unsafe')}
                    </span>
                  )}
                </div>

                {/* Actions - Increased spacing */}
                <div className="w-40 flex items-center justify-end gap-2">
                  {/* Update button for skills with sourceUrl */}
                  {skill.sourceUrl && (
                    <button
                      className="btn btn-ghost btn-xs gap-1 rounded-lg text-primary hover:bg-primary/10"
                      onClick={() => handleSingleUpdate(skill.id)}
                      disabled={updatingSkillId === skill.id}
                      title={t('batchUpdate')}
                    >
                      {updatingSkillId === skill.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs rounded-lg"
                    onClick={() => handleViewSkill(skill)}
                    title={t('view')}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error rounded-lg hover:bg-error/10"
                    onClick={() => handleUninstall(skill)}
                    disabled={isDeleting}
                    title={t('remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-base-200/50 rounded-2xl border border-base-300 p-12 text-center">
          <FolderOpen size={48} strokeWidth={1} className="mx-auto mb-3 opacity-50 text-base-content/40" />
          <p className="text-base-content/50">
            {t('noSkillsFound', { type: activeTab !== 'all' ? (activeTab === 'system' ? t('systemLevel') : t('projectLevel')) + ' ' : '' })}
          </p>
          <p className="text-sm mt-2 text-base-content/40">
            {t('installOrImport')}
          </p>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedSkill && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-base-200 bg-base-100 shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  {selectedSkill.name}
                  {selectedSkill.version && (
                    <span className="badge badge-ghost badge-sm font-mono">v{selectedSkill.version}</span>
                  )}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-xs text-base-content/50 font-mono">
                    {selectedSkill.localPath}
                  </span>
                </div>
                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-base-content/60">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(selectedSkill.installDate)}
                  </span>
                  {selectedSkill.sourceUrl ? (
                    <button
                      className="flex items-center gap-1 text-primary hover:underline"
                      onClick={() => invoke('open_url', { url: selectedSkill.sourceUrl })}
                    >
                      {getSourceIcon(selectedSkill.source)}
                      {getSourceLabel(selectedSkill.source)}
                      <ExternalLink size={10} />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1">
                      {getSourceIcon(selectedSkill.source)}
                      {getSourceLabel(selectedSkill.source)}
                    </span>
                  )}
                  {selectedSkill.author && (
                    <span className="flex items-center gap-1">
                      {t('author')}: {selectedSkill.author}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedSkill(null);
                  setSkillContent('');
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-base-200 p-6">
              <div className="prose prose-sm max-w-none bg-base-100 p-6 rounded-xl shadow-sm">
                <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono bg-transparent">
                  {skillContent || t('loading')}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-base-200 bg-base-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {selectedSkill.sourceUrl && (
                  <>
                    <button
                      className="btn btn-ghost btn-sm gap-2 rounded-xl"
                      onClick={() => invoke('open_url', { url: selectedSkill.sourceUrl })}
                    >
                      <ExternalLink size={14} />
                      {t('viewSource')}
                    </button>
                    <button
                      className="btn btn-primary btn-sm gap-2 rounded-xl"
                      onClick={() => handleSingleUpdate(selectedSkill.id)}
                      disabled={updatingSkillId === selectedSkill.id}
                    >
                      {updatingSkillId === selectedSkill.id ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Download size={14} />
                      )}
                      {t('redownload')}
                    </button>
                  </>
                )}
              </div>
              <button
                className="btn rounded-xl"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedSkill(null);
                  setSkillContent('');
                }}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl">{t('importSkill')}</h3>
              <button
                className="btn btn-sm btn-circle btn-ghost"
                onClick={closeImportModal}
              >
                <X size={20} />
              </button>
            </div>

            {!importType ? (
              <div className="space-y-3">
                <p className="text-sm text-base-content/60 mb-4">
                  {t('selectImportMethod')}
                </p>

                <div
                  className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors p-4 rounded-xl"
                  onClick={() => setImportType('github')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center shrink-0">
                      <Github size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-1">{t('importFromGitHub')}</div>
                      <div className="text-sm text-base-content/60">
                        {t('githubRepoDesc')}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors p-4 rounded-xl"
                  onClick={() => setImportType('local')}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-base-100 flex items-center justify-center shrink-0">
                      <HardDrive size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base mb-1">{t('importFromLocal')}</div>
                      <div className="text-sm text-base-content/60">
                        {t('localFolderDesc')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="alert alert-info rounded-xl">
                  <div className="flex items-center gap-3">
                    {importType === 'github' ? <Github size={20} /> : <HardDrive size={20} />}
                    <span className="text-sm">
                      {importType === 'github' ? t('importFromGitHub') : t('importFromLocal')}
                    </span>
                  </div>
                </div>

                {importType === 'github' ? (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">
                        {t('githubRepoUrl')}
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://github.com/username/skill-name"
                      className="input input-bordered w-full rounded-xl"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      autoFocus
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/50">
                        {t('repoMustContainSkill')}
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">
                        {t('localFolderPath')}
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="/Users/user/Downloads/my-skill"
                      className="input input-bordered w-full rounded-xl"
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                      autoFocus
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/50">
                        {t('folderMustContainSkill')}
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="btn btn-ghost rounded-xl"
                    onClick={() => {
                      setImportType(null);
                      setImportUrl('');
                      setImportPath('');
                    }}
                  >
                    {t('back')}
                  </button>
                  <button
                    className="btn btn-primary rounded-xl shadow-lg shadow-primary/25"
                    onClick={handleImport}
                    disabled={isImporting || (importType === 'github' ? !importUrl.trim() : !importPath.trim())}
                  >
                    {isImporting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        {t('importing')}
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        {t('confirmImport')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MySkills;
