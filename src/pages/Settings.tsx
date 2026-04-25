import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkillStore } from '../store/useSkillStore';
import { Plus, X, FolderOpen, ExternalLink, Package, Check, Cpu, Settings2, Palette, AlertTriangle, Globe, Link2, Link2Off, RefreshCw, Monitor, CheckCircle2, Github, Heart, MessageCircle, Terminal, Key, Server, Eye, EyeOff, Save, RotateCcw, Play, XCircle, Shield, Search } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

// Native agents that are already managed in the built-in symlink/native sections
const NATIVE_AGENT_IDS = new Set(['claude-code', 'github-copilot', 'cursor', 'opencode', 'antigravity', 'amp']);

// Known agent global paths for custom symlink quick-select (excluding native agents)
const KNOWN_AGENT_PATHS: { name: string; id: string; globalPath: string }[] = [
  { name: 'Kimi Code CLI', id: 'kimi-cli', globalPath: '~/.config/agents/skills/' },
  { name: 'Augment', id: 'augment', globalPath: '~/.augment/rules/' },
  { name: 'OpenClaw', id: 'openclaw', globalPath: '~/.moltbot/skills/' },
  { name: 'Cline', id: 'cline', globalPath: '~/.cline/skills/' },
  { name: 'CodeBuddy', id: 'codebuddy', globalPath: '~/.codebuddy/skills/' },
  { name: 'Codex', id: 'codex', globalPath: '~/.codex/skills/' },
  { name: 'Command Code', id: 'command-code', globalPath: '~/.commandcode/skills/' },
  { name: 'Continue', id: 'continue', globalPath: '~/.continue/skills/' },
  { name: 'Crush', id: 'crush', globalPath: '~/.config/crush/skills/' },
  { name: 'Droid', id: 'droid', globalPath: '~/.factory/skills/' },
  { name: 'Gemini CLI', id: 'gemini-cli', globalPath: '~/.gemini/skills/' },
  { name: 'Goose', id: 'goose', globalPath: '~/.config/goose/skills/' },
  { name: 'Junie', id: 'junie', globalPath: '~/.junie/skills/' },
  { name: 'iFlow CLI', id: 'iflow-cli', globalPath: '~/.iflow/skills/' },
  { name: 'Kilo Code', id: 'kilo', globalPath: '~/.kilocode/skills/' },
  { name: 'Kiro CLI', id: 'kiro-cli', globalPath: '~/.kiro/skills/' },
  { name: 'Kode', id: 'kode', globalPath: '~/.kode/skills/' },
  { name: 'MCPJam', id: 'mcpjam', globalPath: '~/.mcpjam/skills/' },
  { name: 'Mistral Vibe', id: 'mistral-vibe', globalPath: '~/.vibe/skills/' },
  { name: 'Mux', id: 'mux', globalPath: '~/.mux/skills/' },
  { name: 'OpenClaude IDE', id: 'openclaude', globalPath: '~/.openclaude/skills/' },
  { name: 'OpenHands', id: 'openhands', globalPath: '~/.openhands/skills/' },
  { name: 'Pi', id: 'pi', globalPath: '~/.pi/agent/skills/' },
  { name: 'Qoder', id: 'qoder', globalPath: '~/.qoder/skills/' },
  { name: 'Qwen Code', id: 'qwen-code', globalPath: '~/.qwen/skills/' },
  { name: 'Roo Code', id: 'roo', globalPath: '~/.roo/skills/' },
  { name: 'Trae', id: 'trae', globalPath: '~/.trae/skills/' },
  { name: 'Trae CN', id: 'trae-cn', globalPath: '~/.trae-cn/skills/' },
  { name: 'Windsurf', id: 'windsurf', globalPath: '~/.codeium/windsurf/skills/' },
  { name: 'Zencoder', id: 'zencoder', globalPath: '~/.zencoder/skills/' },
  { name: 'Neovate', id: 'neovate', globalPath: '~/.neovate/skills/' },
  { name: 'Pochi', id: 'pochi', globalPath: '~/.pochi/skills/' },
  { name: 'AdaL', id: 'adal', globalPath: '~/.adal/skills/' },
];

const agentColors: Record<string, string> = {
  'claude-code': 'bg-orange-500',
  'github-copilot': 'bg-gray-800',
  'cursor': 'bg-cyan-400',
  'codex': 'bg-green-500',
  'opencode': 'bg-indigo-500',
  'antigravity': 'bg-blue-500',
  'gemini-cli': 'bg-purple-500',
  'windsurf': 'bg-emerald-500',
  'amp': 'bg-red-400',
  'roo': 'bg-amber-500',
  'trae': 'bg-pink-500',
};

const Settings = () => {
  const { t, i18n } = useTranslation();
  const {
    projectPaths,
    fetchProjectPaths,
    saveProjectPaths,
    defaultInstallLocation,
    setDefaultInstallLocation,
    selectedProjectIndex,
    setSelectedProjectIndex,
    agents,
    symlinkStatuses,
    platform,
    fetchAgents,
    fetchSymlinkAgents,
    checkSymlinkStatus,
    createSymlink,
    createAllSymlinks,
    removeSymlink,
    getPlatformInfo,
    apiUrl,
    apiKey,
    setApiUrl,
    setApiKey,
    fetchMarketplaceSkills,
    proxyEnabled,
    proxyUrl: storeProxyUrl,
    setProxyEnabled,
    setProxyUrl,
    getProxyUrl,
    customSymlinks,
    addCustomSymlinkPath,
    removeCustomSymlinkPath,
    createCustomSymlink,
    removeCustomSymlink,
    checkCustomSymlinks
  } = useSkillStore();

  // Normalize path for comparison: strip trailing slash, keep ~/
  const normalizePath = (p: string) => p.replace(/\/+$/, '');
  // Convert absolute home path to ~/ format
  const toTildePath = (p: string) => {
    const home = p.match(/^\/(?:Users|home)\/[^/]+/);
    return home ? p.replace(home[0], '~') : p;
  };
  // Get all existing configured paths as a normalized set
  const getExistingPathSet = () => {
    return new Set([
      ...agents.map(a => normalizePath(`~/${a.globalSkillsDir}`)),
      ...customSymlinks.map(s => normalizePath(s.path)),
      ...symlinkStatuses.map(s => normalizePath(toTildePath(s.linkPath))),
    ]);
  };
  const [paths, setPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [isCreatingSymlinks, setIsCreatingSymlinks] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  
  // API Settings local state
  const [localApiUrl, setLocalApiUrl] = useState('');
  const [localApiKey, setLocalApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiSaved, setApiSaved] = useState(false);
  const [testResult, setTestResult] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});

  // Proxy Settings local state
  const [localProxyEnabled, setLocalProxyEnabled] = useState(false);
  const [localProxyUrl, setLocalProxyUrl] = useState('');
  const [proxySaved, setProxySaved] = useState(false);
  const [symlinkToast, setSymlinkToast] = useState<{show: boolean, success: boolean, message: string}>({show: false, success: false, message: ''});

  // Custom symlink state
  const [newCustomPath, setNewCustomPath] = useState('');
  const [customActionInProgress, setCustomActionInProgress] = useState<string | null>(null);
  const [showCustomSymlinkModal, setShowCustomSymlinkModal] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');

  // Collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    native: false,
    symlink: false,
    api: false,
    proxy: false,
    install: false,
    paths: false,
    appearance: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    fetchProjectPaths();
    fetchAgents();
    fetchSymlinkAgents();
    checkSymlinkStatus();
    checkCustomSymlinks();
    getPlatformInfo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize local API settings from store
  useEffect(() => {
    setLocalApiUrl(apiUrl);
    setLocalApiKey(apiKey);
  }, [apiUrl, apiKey]);

  // Initialize local proxy settings from store
  useEffect(() => {
    setLocalProxyEnabled(proxyEnabled);
    setLocalProxyUrl(storeProxyUrl);
  }, [proxyEnabled, storeProxyUrl]);

  useEffect(() => {
    setPaths(projectPaths);
  }, [projectPaths]);

  const handleAddPath = async () => {
    if (newPath && !paths.includes(newPath)) {
      const updatedPaths = [...paths, newPath];
      setPaths(updatedPaths);
      setNewPath('');
      try {
        await saveProjectPaths(updatedPaths);
      } catch (error) {
        console.error('Failed to save paths:', error);
        alert(t('saveError'));
      }
    }
  };

  const handleRemovePath = async (pathToRemove: string) => {
    const updatedPaths = paths.filter(p => p !== pathToRemove);
    setPaths(updatedPaths);
    try {
      await saveProjectPaths(updatedPaths);
    } catch (error) {
      console.error('Failed to save paths:', error);
      alert(t('saveError'));
    }
  };

  const handleCreateAllSymlinks = async () => {
    setIsCreatingSymlinks(true);
    try {
      const statuses = await createAllSymlinks();
      const successCount = statuses.filter((s: any) => s.isValid).length;
      const failCount = statuses.length - successCount;
      const errorMsgs = statuses.filter((s: any) => s.error).map((s: any) => `${s.agentName}: ${s.error}`);
      if (failCount > 0) {
        setSymlinkToast({
          show: true,
          success: false,
          message: i18n.language === 'zh'
            ? `${successCount} 个成功，${failCount} 个失败${errorMsgs.length > 0 ? '\n' + errorMsgs.join('\n') : ''}`
            : `${successCount} succeeded, ${failCount} failed${errorMsgs.length > 0 ? '\n' + errorMsgs.join('\n') : ''}`
        });
      } else {
        setSymlinkToast({
          show: true,
          success: true,
          message: i18n.language === 'zh' ? `全部 ${successCount} 个软链接创建成功` : `All ${successCount} symlinks created successfully`
        });
      }
    } catch (error) {
      console.error('Failed to create symlinks:', error);
      setSymlinkToast({
        show: true,
        success: false,
        message: i18n.language === 'zh' ? `创建失败: ${error}` : `Creation failed: ${error}`
      });
    } finally {
      setIsCreatingSymlinks(false);
      setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 5000);
    }
  };

  const handleCreateSymlink = async (agentId: string) => {
    setActionInProgress(agentId);
    try {
      const status = await createSymlink(agentId);
      if (status.error) {
        setSymlinkToast({
          show: true,
          success: false,
          message: `${status.agentName}: ${status.error}`
        });
      } else if (status.isValid) {
        setSymlinkToast({
          show: true,
          success: true,
          message: i18n.language === 'zh' ? `${status.agentName} 软链接创建成功` : `${status.agentName} symlink created`
        });
      }
    } catch (error) {
      console.error(`Failed to create symlink for ${agentId}:`, error);
      setSymlinkToast({
        show: true,
        success: false,
        message: i18n.language === 'zh' ? `创建失败: ${error}` : `Creation failed: ${error}`
      });
    } finally {
      setActionInProgress(null);
      setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 5000);
    }
  };

  const handleRemoveSymlink = async (agentId: string) => {
    setActionInProgress(agentId);
    try {
      const status = await removeSymlink(agentId);
      setSymlinkToast({
        show: true,
        success: true,
        message: i18n.language === 'zh' ? `${status.agentName} 软链接已移除` : `${status.agentName} symlink removed`
      });
    } catch (error) {
      console.error(`Failed to remove symlink for ${agentId}:`, error);
      setSymlinkToast({
        show: true,
        success: false,
        message: i18n.language === 'zh' ? `移除失败: ${error}` : `Remove failed: ${error}`
      });
    } finally {
      setActionInProgress(null);
      setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 5000);
    }
  };

  const getSymlinkStatus = (agentId: string) => {
    return symlinkStatuses.find(s => s.agentId === agentId);
  };

  const handleSaveApiSettings = () => {
    setApiUrl(localApiUrl.trim());
    setApiKey(localApiKey.trim());
    setApiSaved(true);
    // Refresh marketplace with new settings
    setTimeout(() => {
      fetchMarketplaceSkills();
      setApiSaved(false);
    }, 1000);
  };

  const handleResetApiSettings = () => {
    setLocalApiUrl('');
    setLocalApiKey('');
    setApiUrl('');
    setApiKey('');
    setApiSaved(true);
    setTimeout(() => {
      fetchMarketplaceSkills();
      setApiSaved(false);
    }, 1000);
  };

  const handleTestApi = async () => {
    // Only test if API URL is configured
    if (!localApiUrl) {
      setTestResult({
        show: true,
        success: false,
        message: i18n.language === 'zh' ? '请先配置 API 地址' : 'Please configure API URL first'
      });
      setTimeout(() => setTestResult({show: false, success: false, message: ''}), 3000);
      return;
    }
    
    const testUrl = localApiUrl;
    const testKey = localApiKey;
    
    console.log('========== [API Test] ==========');
    console.log('Testing URL:', testUrl);
    console.log('Testing Key:', testKey ? `${testKey.substring(0, 15)}...` : 'NOT SET');
    
    try {
      let fullUrl: string;
      if (testUrl.startsWith('http')) {
        const url = new URL(testUrl);
        url.searchParams.set('limit', '5');
        fullUrl = url.toString();
      } else {
        fullUrl = `${testUrl}?limit=5`;
      }
      
      console.log('Full URL:', fullUrl);
      console.log('Using Tauri fetch_api command (bypasses CORS)');
      
      // Use Tauri command to bypass CORS
      const response: { status: number; body: string } = await invoke('fetch_api', {
        request: {
          url: fullUrl,
          apiKey: testKey || null,
          proxyUrl: getProxyUrl()
        }
      });
      const data = JSON.parse(response.body);
      
      console.log('Response Status:', response.status);
      console.log('Response Data:', data);
      console.log('Skills Count:', data.data?.skills?.length || 0);
      console.log('========== [End API Test] ==========');
      
      setTestResult({
        show: true,
        success: true,
        message: i18n.language === 'zh' 
          ? `测试成功! 状态: ${response.status}` 
          : `Test Success! Status: ${response.status}`
      });
    } catch (error) {
      console.error('API Test Error:', error);
      setTestResult({
        show: true,
        success: false,
        message: i18n.language === 'zh' ? `测试失败: ${error}` : `Test Failed: ${error}`
      });
    } finally {
      setTimeout(() => setTestResult({show: false, success: false, message: ''}), 5000);
    }
  };

  // Filter agents by compatibility
  const nativeAgents = agents.filter(a => a.compatibility === 'native');
  const symlinkRequiredAgents = agents.filter(a => a.compatibility === 'symlink');

  // Count linked agents
  const linkedCount = symlinkRequiredAgents.filter(a => {
    const status = getSymlinkStatus(a.id);
    return status?.exists && status?.isValid;
  }).length;

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* Symlink Toast */}
      {symlinkToast.show && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${symlinkToast.success ? 'alert-success' : 'alert-error'} shadow-lg rounded-2xl max-w-sm`}>
            <span className="whitespace-pre-line text-sm">{symlinkToast.message}</span>
          </div>
        </div>
      )}

      {/* Left: Settings Sections */}
      <div className="flex-1 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-primary to-violet-500 rounded-xl">
            <Settings2 size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('settings')}</h2>
            <div className="flex items-center gap-3 text-sm text-base-content/60">
              {platform && (
                <>
                  <span className="flex items-center gap-1">
                    <Monitor size={12} />
                    {platform.os.toUpperCase()} · {platform.arch}
                  </span>
                  {platform.os === 'windows' && (
                    <span className="text-warning flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {i18n.language === 'zh' ? '需管理员权限' : 'Admin required'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Native Compatible Agents */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.native}
            onChange={() => toggleSection('native')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-success/10 rounded-lg">
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {i18n.language === 'zh' ? '原生兼容 Agents' : 'Native Compatible Agents'}
                </span>
                <span className="ml-2 text-xs text-base-content/50">
                  {nativeAgents.length} {i18n.language === 'zh' ? '个' : 'agents'}
                </span>
              </div>
              <div className="flex -space-x-1">
                {nativeAgents.slice(0, 5).map(agent => (
                  <div
                    key={agent.id}
                    className={`w-5 h-5 rounded-full ${agentColors[agent.id] || 'bg-gray-500'} border-2 border-base-100`}
                    title={agent.displayName}
                  />
                ))}
                {nativeAgents.length > 5 && (
                  <div className="w-5 h-5 rounded-full bg-base-300 border-2 border-base-100 flex items-center justify-center text-[10px]">
                    +{nativeAgents.length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 grid grid-cols-2 lg:grid-cols-3 gap-2">
              {nativeAgents.map(agent => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 p-2 bg-base-100 rounded-xl"
                >
                  <div className={`w-3 h-3 rounded-full ${agentColors[agent.id] || 'bg-gray-500'}`} />
                  <span className="text-sm font-medium truncate">{agent.displayName}</span>
                  <Check size={12} className="text-success ml-auto shrink-0" />
                </div>
              ))}
            </div>
            <p className="text-xs text-base-content/50 mt-3">
              {i18n.language === 'zh'
                ? '这些 Agents 自动扫描 Claude Code Skills 目录，无需额外配置'
                : 'These agents auto-scan Claude Code skills directory, no configuration needed'}
            </p>
          </div>
        </div>

        {/* Symlink Configuration */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.symlink}
            onChange={() => toggleSection('symlink')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Link2 size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {i18n.language === 'zh' ? '软链接配置' : 'Symlink Configuration'}
                </span>
                <span className="ml-2 text-xs text-base-content/50">
                  {linkedCount + customSymlinks.filter(s => s.exists).length}/{symlinkRequiredAgents.length + customSymlinks.length} {i18n.language === 'zh' ? '已链接' : 'linked'}
                </span>
              </div>
              {linkedCount < symlinkRequiredAgents.length && (
                <span className="stat-badge bg-warning/20 text-warning text-xs">
                  {symlinkRequiredAgents.length - linkedCount} {i18n.language === 'zh' ? '待配置' : 'pending'}
                </span>
              )}
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {symlinkRequiredAgents.map(agent => {
                const status = getSymlinkStatus(agent.id);
                const isLinked = status?.exists && status?.isValid;
                const isLoading = actionInProgress === agent.id;

                return (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isLinked ? 'bg-success/5 border border-success/20' : 'bg-base-100 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${agentColors[agent.id] || 'bg-gray-500'}`}>
                      <Cpu size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{agent.displayName}</div>
                      <div className="text-xs text-base-content/40 font-mono truncate">
                        ~/{agent.globalSkillsDir}
                      </div>
                      {status?.error && !isLinked && (
                        <div className="text-xs text-error mt-0.5 truncate" title={status.error}>
                          {status.error}
                        </div>
                      )}
                    </div>
                    {isLinked ? (
                      <button
                        className="btn btn-xs btn-ghost text-error gap-1"
                        onClick={() => handleRemoveSymlink(agent.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Link2Off size={12} />
                        )}
                        {i18n.language === 'zh' ? '移除' : 'Remove'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-xs btn-primary gap-1"
                        onClick={() => handleCreateSymlink(agent.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Link2 size={12} />
                        )}
                        {i18n.language === 'zh' ? '链接' : 'Link'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom symlinks in the same list */}
            {customSymlinks.map((symlink) => (
              <div
                key={`custom-${symlink.path}`}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  symlink.exists ? 'bg-success/5 border border-success/20' : 'bg-base-100 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary/20">
                  <Terminal size={14} className="text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {symlink.path.split('/').pop() || symlink.path}
                    <span className="badge badge-xs badge-secondary badge-outline">{i18n.language === 'zh' ? '自定义' : 'Custom'}</span>
                  </div>
                  <div className="text-xs text-base-content/40 font-mono truncate" title={symlink.path}>
                    {symlink.path}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {symlink.exists ? (
                    <button
                      className="btn btn-xs btn-ghost text-error gap-1"
                      onClick={async () => {
                        setCustomActionInProgress(symlink.path);
                        try {
                          const ok = await removeCustomSymlink(symlink.path);
                          setSymlinkToast({
                            show: true,
                            success: ok,
                            message: ok
                              ? (i18n.language === 'zh' ? `已移除: ${symlink.path}` : `Removed: ${symlink.path}`)
                              : (i18n.language === 'zh' ? `移除失败: ${symlink.path}` : `Remove failed: ${symlink.path}`)
                          });
                        } catch (e) {
                          setSymlinkToast({ show: true, success: false, message: `${e}` });
                        } finally {
                          setCustomActionInProgress(null);
                          setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 5000);
                        }
                      }}
                      disabled={customActionInProgress === symlink.path}
                    >
                      {customActionInProgress === symlink.path ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Link2Off size={12} />
                      )}
                      {i18n.language === 'zh' ? '移除' : 'Remove'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-xs btn-primary gap-1"
                      onClick={async () => {
                        setCustomActionInProgress(symlink.path);
                        try {
                          const result = await createCustomSymlink(symlink.path);
                          setSymlinkToast({
                            show: true,
                            success: result.success,
                            message: result.success
                              ? (i18n.language === 'zh' ? `已链接: ${symlink.path}` : `Linked: ${symlink.path}`)
                              : (result.error || (i18n.language === 'zh' ? `链接失败: ${symlink.path}` : `Link failed: ${symlink.path}`))
                          });
                        } catch (e) {
                          setSymlinkToast({ show: true, success: false, message: `${e}` });
                        } finally {
                          setCustomActionInProgress(null);
                          setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 5000);
                        }
                      }}
                      disabled={customActionInProgress === symlink.path}
                    >
                      {customActionInProgress === symlink.path ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Link2 size={12} />
                      )}
                      {i18n.language === 'zh' ? '链接' : 'Link'}
                    </button>
                  )}
                  <button
                    className="btn btn-xs btn-ghost text-base-content/40 hover:text-error"
                    onClick={() => removeCustomSymlinkPath(symlink.path)}
                    title={i18n.language === 'zh' ? '删除此条目' : 'Delete this entry'}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 mt-4">
              <button
                className="btn btn-sm btn-primary gap-2"
                onClick={handleCreateAllSymlinks}
                disabled={isCreatingSymlinks}
              >
                {isCreatingSymlinks ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Link2 size={14} />
                )}
                {i18n.language === 'zh' ? '一键配置全部' : 'Setup All'}
              </button>
              <button
                className="btn btn-sm btn-ghost gap-2"
                onClick={() => { checkSymlinkStatus(); checkCustomSymlinks(); }}
              >
                <RefreshCw size={14} />
                {i18n.language === 'zh' ? '刷新' : 'Refresh'}
              </button>
              <button
                className="btn btn-sm btn-secondary gap-2"
                onClick={() => setShowCustomSymlinkModal(true)}
              >
                <Plus size={14} />
                {i18n.language === 'zh' ? '自定义软链接' : 'Custom Symlink'}
              </button>
            </div>
          </div>
        </div>

        {/* Custom Symlink Modal */}
        {showCustomSymlinkModal && (
          <div className="modal modal-open">
            <div className="modal-box rounded-2xl max-w-lg">
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
                onClick={() => { setShowCustomSymlinkModal(false); setNewCustomPath(''); setAgentSearchQuery(''); }}
              >
                <X size={16} />
              </button>
              <h3 className="font-bold text-lg flex items-center gap-2 mb-1">
                <Plus size={18} className="text-secondary" />
                {i18n.language === 'zh' ? '添加自定义软链接' : 'Add Custom Symlink'}
              </h3>
              <p className="text-xs text-base-content/50 mb-4">
                {i18n.language === 'zh'
                  ? '选择已知 Agent 或手动输入自定义路径'
                  : 'Select a known agent or enter a custom path manually'}
              </p>

              {/* Manual input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder={i18n.language === 'zh' ? '输入目标路径，如 ~/.trae-cn/skills' : 'Target path, e.g. ~/.trae-cn/skills'}
                  className="input input-bordered bg-base-200 flex-1 rounded-xl text-sm font-mono"
                  value={newCustomPath}
                  onChange={(e) => setNewCustomPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCustomPath.trim()) {
                      const path = newCustomPath.trim();
                      const existingPaths = getExistingPathSet();
                      if (existingPaths.has(normalizePath(path))) {
                        setSymlinkToast({ show: true, success: false, message: i18n.language === 'zh' ? `该路径已添加过: ${path}` : `Path already configured: ${path}` });
                        setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 3000);
                        return;
                      }
                      addCustomSymlinkPath(path);
                      setNewCustomPath('');
                      setAgentSearchQuery('');
                      setShowCustomSymlinkModal(false);
                    }
                  }}
                  autoFocus
                />
                <button
                  className="btn btn-secondary rounded-xl gap-1"
                  disabled={!newCustomPath.trim()}
                  onClick={() => {
                    const path = newCustomPath.trim();
                    if (!path) return;
                    const existingPaths = getExistingPathSet();
                    if (existingPaths.has(normalizePath(path))) {
                      setSymlinkToast({ show: true, success: false, message: i18n.language === 'zh' ? `该路径已添加过: ${path}` : `Path already configured: ${path}` });
                      setTimeout(() => setSymlinkToast({show: false, success: false, message: ''}), 3000);
                      return;
                    }
                    addCustomSymlinkPath(path);
                    setNewCustomPath('');
                    setAgentSearchQuery('');
                    setShowCustomSymlinkModal(false);
                  }}
                >
                  <Plus size={14} />
                  {i18n.language === 'zh' ? '添加' : 'Add'}
                </button>
              </div>

              {/* Quick-select known agents */}
              <div className="border border-base-300 rounded-xl overflow-hidden">
                <div className="bg-base-200/60 px-3 py-2 flex items-center gap-2">
                  <Search size={14} className="text-base-content/40" />
                  <input
                    type="text"
                    placeholder={i18n.language === 'zh' ? '搜索 Agent...' : 'Search agents...'}
                    className="bg-transparent text-sm flex-1 outline-none placeholder:text-base-content/30"
                    value={agentSearchQuery}
                    onChange={(e) => setAgentSearchQuery(e.target.value)}
                  />
                  {agentSearchQuery && (
                    <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setAgentSearchQuery('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-base-200">
                  {(() => {
                    const existingPaths = getExistingPathSet();
                    const q = agentSearchQuery.toLowerCase();
                    const filtered = KNOWN_AGENT_PATHS.filter(a =>
                      (a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.globalPath.toLowerCase().includes(q))
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-6 text-base-content/30 text-sm">
                          {i18n.language === 'zh' ? '未找到匹配的 Agent' : 'No matching agents found'}
                        </div>
                      );
                    }
                    return filtered.map(agent => {
                      const isExisting = existingPaths.has(normalizePath(agent.globalPath));
                      return (
                        <button
                          key={agent.id}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                            isExisting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-base-200/80 cursor-pointer'
                          }`}
                          disabled={isExisting}
                          onClick={() => {
                            if (isExisting) return;
                            addCustomSymlinkPath(agent.globalPath);
                            setNewCustomPath('');
                            setAgentSearchQuery('');
                            setShowCustomSymlinkModal(false);
                          }}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${agentColors[agent.id] || 'bg-base-300'}`}>
                            <Terminal size={12} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium flex items-center gap-1.5">
                              {agent.name}
                              {isExisting && (
                                <span className="badge badge-xs badge-ghost text-base-content/40">
                                  {i18n.language === 'zh' ? '已添加' : 'Added'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-base-content/40 font-mono truncate">{agent.globalPath}</div>
                          </div>
                          {isExisting ? (
                            <Check size={14} className="text-success shrink-0" />
                          ) : (
                            <Plus size={14} className="text-base-content/30 shrink-0" />
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="modal-action">
                <button
                  className="btn btn-ghost rounded-xl"
                  onClick={() => { setShowCustomSymlinkModal(false); setNewCustomPath(''); setAgentSearchQuery(''); }}
                >
                  {i18n.language === 'zh' ? '关闭' : 'Close'}
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => { setShowCustomSymlinkModal(false); setNewCustomPath(''); setAgentSearchQuery(''); }} />
          </div>
        )}

        {/* API Configuration */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.api}
            onChange={() => toggleSection('api')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-info/10 rounded-lg">
                <Server size={16} className="text-info" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {i18n.language === 'zh' ? 'API 配置' : 'API Configuration'}
                </span>
              </div>
              {(apiUrl || apiKey) && (
                <span className="stat-badge bg-success/20 text-success text-xs">
                  {i18n.language === 'zh' ? '已配置' : 'Configured'}
                </span>
              )}
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-4">
              {/* API URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe size={14} className="text-base-content/50" />
                  {i18n.language === 'zh' ? 'API 地址' : 'API URL'}
                </label>
                <input
                  type="text"
                  placeholder="https://skills.lc/api/v1/skills/search"
                  className="input input-sm bg-base-100 border-base-300 w-full rounded-lg text-sm font-mono"
                  value={localApiUrl}
                  onChange={(e) => setLocalApiUrl(e.target.value)}
                />
                <p className="text-xs text-base-content/50">
                  {i18n.language === 'zh' 
                    ? '配置 Skills 市场的 API 端点地址' 
                    : 'Configure the API endpoint URL for Skills Marketplace'}
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Key size={14} className="text-base-content/50" />
                  {i18n.language === 'zh' ? 'API 密钥' : 'API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk_live_xxxxxx..."
                    className="input input-sm bg-base-100 border-base-300 w-full rounded-lg text-sm font-mono pr-10"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-xs text-base-content/50">
                  {i18n.language === 'zh' 
                    ? '用于 API 认证的 Bearer Token' 
                    : 'Bearer token for API authentication'}
                  {' • '}
                  <a 
                    href="https://skills.lc/docs/api-reference" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {i18n.language === 'zh' ? '获取密钥' : 'Get API Key'}
                  </a>
                </p>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  className={`btn btn-sm gap-2 ${
                    apiSaved ? 'btn-success' : 'btn-primary'
                  }`}
                  onClick={handleSaveApiSettings}
                  disabled={apiSaved}
                >
                  {apiSaved ? (
                    <>
                      <Check size={14} />
                      {i18n.language === 'zh' ? '已保存' : 'Saved'}
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      {i18n.language === 'zh' ? '保存配置' : 'Save Settings'}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-info btn-outline gap-2"
                  onClick={handleTestApi}
                >
                  <Play size={14} />
                  {i18n.language === 'zh' ? '测试连接' : 'Test'}
                </button>
                <button
                  className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-error"
                  onClick={handleResetApiSettings}
                  disabled={apiSaved || (!localApiUrl && !localApiKey)}
                >
                  <RotateCcw size={14} />
                  {i18n.language === 'zh' ? '重置' : 'Reset'}
                </button>
                {(localApiUrl !== apiUrl || localApiKey !== apiKey) && (
                  <span className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {i18n.language === 'zh' ? '有未保存的更改' : 'Unsaved changes'}
                  </span>
                )}
              </div>

              {/* Test Result */}
              {testResult.show && (
                <div
                  className={`rounded-xl p-3 text-sm flex items-center gap-2 transition-all ${
                    testResult.success
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-error/10 text-error border border-error/20'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <XCircle size={16} className="shrink-0" />
                  )}
                  <span className="flex-1">{testResult.message}</span>
                </div>
              )}

              {/* Info */}
              <div className="bg-base-100 rounded-xl p-3 text-xs text-base-content/60 space-y-2">
                <p>
                  {i18n.language === 'zh' 
                    ? '默认使用本地数据，配置 API 后才会从接口获取数据' 
                    : 'Uses local data by default. Configure API to fetch from remote.'}
                </p>
                <p className="font-mono text-[10px] text-base-content/40">
                  API: https://skills.lc/api/v1/skills/search
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Proxy Configuration */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.proxy}
            onChange={() => toggleSection('proxy')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-orange-500/10 rounded-lg">
                <Shield size={16} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {i18n.language === 'zh' ? '代理设置' : 'Proxy Settings'}
                </span>
              </div>
              {proxyEnabled && storeProxyUrl ? (
                <span className="stat-badge bg-success/20 text-success text-xs">
                  {i18n.language === 'zh' ? '已启用' : 'Enabled'}
                </span>
              ) : (
                <span className="stat-badge bg-base-300 text-xs">
                  {i18n.language === 'zh' ? '未启用' : 'Disabled'}
                </span>
              )}
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-4">
              {/* Proxy Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {i18n.language === 'zh' ? '启用代理' : 'Enable Proxy'}
                  </div>
                  <p className="text-xs text-base-content/50 mt-0.5">
                    {i18n.language === 'zh'
                      ? '启用后，所有外部请求将通过代理服务器'
                      : 'When enabled, all external requests will go through the proxy'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={localProxyEnabled}
                  onChange={(e) => setLocalProxyEnabled(e.target.checked)}
                />
              </div>
        
              {/* Proxy URL */}
              <div className={`space-y-2 transition-opacity ${localProxyEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe size={14} className="text-base-content/50" />
                  {i18n.language === 'zh' ? '代理地址' : 'Proxy URL'}
                </label>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:7890"
                  className="input input-sm bg-base-100 border-base-300 w-full rounded-lg text-sm font-mono"
                  value={localProxyUrl}
                  onChange={(e) => setLocalProxyUrl(e.target.value)}
                />
                <p className="text-xs text-base-content/50">
                  {i18n.language === 'zh'
                    ? '支持 HTTP/HTTPS/SOCKS5 代理，例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080'
                    : 'Supports HTTP/HTTPS/SOCKS5 proxy, e.g. http://127.0.0.1:7890 or socks5://127.0.0.1:1080'}
                </p>
              </div>
        
              {/* Save Proxy */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  className={`btn btn-sm gap-2 ${proxySaved ? 'btn-success' : 'btn-primary'}`}
                  onClick={() => {
                    setProxyEnabled(localProxyEnabled);
                    setProxyUrl(localProxyUrl.trim());
                    setProxySaved(true);
                    setTimeout(() => setProxySaved(false), 1500);
                  }}
                  disabled={proxySaved}
                >
                  {proxySaved ? (
                    <>
                      <Check size={14} />
                      {i18n.language === 'zh' ? '已保存' : 'Saved'}
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      {i18n.language === 'zh' ? '保存设置' : 'Save Settings'}
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-error"
                  onClick={() => {
                    setLocalProxyEnabled(false);
                    setLocalProxyUrl('');
                    setProxyEnabled(false);
                    setProxyUrl('');
                    setProxySaved(true);
                    setTimeout(() => setProxySaved(false), 1500);
                  }}
                  disabled={proxySaved || (!localProxyEnabled && !localProxyUrl)}
                >
                  <RotateCcw size={14} />
                  {i18n.language === 'zh' ? '重置' : 'Reset'}
                </button>
                {(localProxyEnabled !== proxyEnabled || localProxyUrl !== storeProxyUrl) && (
                  <span className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {i18n.language === 'zh' ? '有未保存的更改' : 'Unsaved changes'}
                  </span>
                )}
              </div>
        
              {/* Info */}
              <div className="bg-base-100 rounded-xl p-3 text-xs text-base-content/60 space-y-1">
                <p>
                  {i18n.language === 'zh'
                    ? '代理将应用于：API 请求、GitHub Skill 下载（git clone）等所有外部网络请求'
                    : 'Proxy applies to: API requests, GitHub skill downloads (git clone), and all external network requests'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Installation Settings */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.install}
            onChange={() => toggleSection('install')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-accent/10 rounded-lg">
                <Globe size={16} className="text-accent" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">
                  {i18n.language === 'zh' ? '安装设置' : 'Installation Settings'}
                </span>
              </div>
              <span className="stat-badge bg-base-300 text-xs">
                {defaultInstallLocation === 'system'
                  ? (i18n.language === 'zh' ? '全局' : 'Global')
                  : (i18n.language === 'zh' ? '项目' : 'Project')
                }
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {/* System Directory Option */}
              <div
                className={`rounded-xl p-3 cursor-pointer transition-all border ${
                  defaultInstallLocation === 'system'
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 hover:border-base-400 bg-base-100'
                }`}
                onClick={() => setDefaultInstallLocation('system')}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="install-location"
                    className="radio radio-primary radio-sm"
                    checked={defaultInstallLocation === 'system'}
                    onChange={() => setDefaultInstallLocation('system')}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {i18n.language === 'zh' ? '系统全局目录' : 'System Global Directory'}
                      <span className="stat-badge bg-success/10 text-success text-xs">
                        {i18n.language === 'zh' ? '推荐' : 'Recommended'}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      ~/.claude/skills • {i18n.language === 'zh' ? '所有项目都能访问' : 'Accessible to all projects'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Project Directory Option */}
              <div
                className={`rounded-xl p-3 cursor-pointer transition-all border ${
                  defaultInstallLocation === 'project'
                    ? 'border-primary bg-primary/5'
                    : 'border-base-300 hover:border-base-400 bg-base-100'
                }`}
                onClick={() => setDefaultInstallLocation('project')}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="install-location"
                    className="radio radio-primary radio-sm"
                    checked={defaultInstallLocation === 'project'}
                    onChange={() => setDefaultInstallLocation('project')}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {i18n.language === 'zh' ? '项目专属目录' : 'Project-Specific Directory'}
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      .claude/skills • {i18n.language === 'zh' ? '可随项目版本控制' : 'Version controlled with project'}
                    </p>
                  </div>
                </div>

                {defaultInstallLocation === 'project' && projectPaths.length > 0 && (
                  <div className="mt-3 ml-7 space-y-1">
                    {projectPaths.map((path, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                          selectedProjectIndex === index
                            ? 'bg-primary/10 border border-primary'
                            : 'bg-base-200 hover:bg-base-300 border border-transparent'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectIndex(index);
                        }}
                      >
                        <input
                          type="radio"
                          name="selected-project"
                          className="radio radio-xs radio-primary"
                          checked={selectedProjectIndex === index}
                          onChange={() => setSelectedProjectIndex(index)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <FolderOpen size={12} className="text-base-content/50" />
                        <span className="font-mono truncate" title={path}>{path}</span>
                      </label>
                    ))}
                  </div>
                )}

                {defaultInstallLocation === 'project' && projectPaths.length === 0 && (
                  <div className="mt-2 ml-7 text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {i18n.language === 'zh' ? '请先在下方添加项目路径' : 'Add project paths below first'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Paths */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.paths}
            onChange={() => toggleSection('paths')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-warning/10 rounded-lg">
                <FolderOpen size={16} className="text-warning" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">{t('projectPaths')}</span>
              </div>
              <span className="stat-badge bg-base-300 text-xs">
                {paths.length} {i18n.language === 'zh' ? '个' : 'paths'}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2 space-y-2">
              {paths.length === 0 ? (
                <div className="text-center py-6 text-base-content/40 border border-dashed border-base-300 rounded-xl text-sm">
                  {i18n.language === 'zh' ? '暂无项目路径' : 'No project paths'}
                </div>
              ) : (
                paths.map((path, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-base-100 rounded-xl group"
                  >
                    <FolderOpen size={14} className="text-warning shrink-0" />
                    <span className="flex-1 font-mono text-xs truncate">{path}</span>
                    <button
                      className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemovePath(path)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder={i18n.language === 'zh' ? '输入项目路径...' : 'Enter project path...'}
                  className="input input-sm bg-base-100 border-base-300 flex-1 rounded-lg text-sm"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddPath()}
                />
                <button
                  className="btn btn-sm btn-primary gap-1"
                  onClick={handleAddPath}
                  disabled={!newPath.trim()}
                >
                  <Plus size={14} />
                  {i18n.language === 'zh' ? '添加' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="collapse collapse-arrow bg-base-200/50 rounded-2xl border border-base-300">
          <input
            type="checkbox"
            checked={expandedSections.appearance}
            onChange={() => toggleSection('appearance')}
          />
          <div className="collapse-title pr-12">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-secondary/10 rounded-lg">
                <Palette size={16} className="text-secondary" />
              </div>
              <span className="font-semibold">
                {i18n.language === 'zh' ? '外观' : 'Appearance'}
              </span>
            </div>
          </div>
          <div className="collapse-content">
            <div className="pt-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-base-content/70">{t('theme')}</span>
                <select className="select select-sm bg-base-100 border-base-300 rounded-lg">
                  <option>{i18n.language === 'zh' ? '跟随系统' : 'Follow System'}</option>
                  <option>{t('light')}</option>
                  <option>{t('dark')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: About & Related */}
      <div className="w-72 shrink-0 space-y-4">
        <div className="sticky top-4 space-y-4">
          {/* About Card */}
          <div className="bg-base-200/50 rounded-2xl p-4 border border-base-300">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Package size={16} className="text-primary" />
              {i18n.language === 'zh' ? '关于' : 'About'}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-base-content/60">{i18n.language === 'zh' ? '版本' : 'Version'}</span>
                <span className="font-mono font-semibold">v1.3.2</span>
              </div>

              <div className="divider my-2"></div>

              <a
                href="#"
                className="flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://skills.lc' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <Globe size={14} />
                <span>SKILLS.LC</span>
                <ExternalLink size={12} className="ml-auto" />
              </a>

              <a
                href="#"
                className="flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/Harries/skills-desktop' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <Github size={14} />
                <span>GitHub</span>
                <ExternalLink size={12} className="ml-auto" />
              </a>

              <a
                href="#"
                className="flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/Harries/skills-desktop/issues' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <Heart size={14} />
                <span>{i18n.language === 'zh' ? '反馈建议' : 'Feedback'}</span>
                <ExternalLink size={12} className="ml-auto" />
              </a>
            </div>
          </div>

          {/* Related Projects Card */}
          <div className="bg-base-200/50 rounded-2xl p-4 border border-base-300">
            <h3 className="font-bold mb-4">
              {i18n.language === 'zh' ? '相关项目' : 'Related Projects'}
            </h3>

            <div className="space-y-3">
              {/* skills-desktop */}
              <a
                href="#"
                className="block p-3 bg-base-100 rounded-xl hover:bg-base-200 transition-colors group"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/Harries/skills-desktop' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg shrink-0">
                    <Terminal size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1">
                      skills-desktop
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {i18n.language === 'zh' ? 'Skill 管理的 Skill，更智能，更便捷' : 'A Skill for managing Skills, smarter and more convenient'}
                    </p>
                  </div>
                </div>
              </a>

              <div className="divider my-2 text-xs text-base-content/40">
                {i18n.language === 'zh' ? '交流群' : 'Community'}
              </div>

              {/* Join Group */}
              <a
                href="#"
                className="block p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl hover:from-primary/20 hover:to-accent/20 transition-colors group border border-primary/20"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://github.com/Harries/skills-desktop/discussions' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg shrink-0">
                    <MessageCircle size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1">
                      {i18n.language === 'zh' ? '加入交流群' : 'Join Community'}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {i18n.language === 'zh' ? '反馈问题、功能建议' : 'Feedback & suggestions'}
                    </p>
                  </div>
                </div>
              </a>
            </div>
          </div>

          {/* Sponsors Card */}
          <div className="bg-gradient-to-br from-base-200/80 to-base-200/40 rounded-2xl p-4 border border-base-300 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-pink-500/5 rounded-full blur-2xl" />
            <h3 className="font-bold mb-3 flex items-center gap-2 relative">
              <div className="p-1 bg-gradient-to-br from-pink-500/20 to-rose-400/20 rounded-md">
                <Heart size={14} className="text-pink-500" />
              </div>
              {i18n.language === 'zh' ? '赞助商' : 'Sponsors'}
            </h3>

            <div className="space-y-2.5 relative">
              <a
                href="#"
                className="block p-3 bg-gradient-to-r from-base-100 to-blue-500/5 rounded-xl hover:from-blue-500/10 hover:to-indigo-500/10 transition-all group border border-transparent hover:border-blue-500/20"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://www.talktg.com/' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shrink-0 shadow-sm shadow-blue-500/20">
                    <MessageCircle size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      TalkTG
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {i18n.language === 'zh' ? '将 Telegram 变成你的服务台' : 'Turn Telegram into Your Help Desk'}
                    </p>
                  </div>
                </div>
              </a>

              <a
                href="#"
                className="block p-3 bg-gradient-to-r from-base-100 to-emerald-500/5 rounded-xl hover:from-emerald-500/10 hover:to-green-500/10 transition-all group border border-transparent hover:border-emerald-500/20"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    await invoke('open_url', { url: 'https://www.issafesite.com/' });
                  } catch (error) {
                    console.error('Failed to open URL:', error);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg shrink-0 shadow-sm shadow-emerald-500/20">
                    <Shield size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      IsSafeSite
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                    </div>
                    <p className="text-xs text-base-content/50 mt-0.5">
                      {i18n.language === 'zh' ? '检测你的网站是否真正安全' : 'Know If Your Site Is Truly Secure'}
                    </p>
                  </div>
                </div>
              </a>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
