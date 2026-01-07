import React, { useLayoutEffect, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Sparkles, Code2, Loader2 } from 'lucide-react';
import type { InputBarProps, CLITool, ImageAttachment } from './types';
import { API } from '../../utils/api';
import { withTimeout } from '../../utils/withTimeout';
import type { TimelineEvent } from '../../types/timeline';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const KnightRiderSpinner: React.FC<{ color?: string }> = ({ color = 'var(--st-accent)' }) => {
  const [frame, setFrame] = useState(0);
  const width = 8;
  const trailLength = 3;
  const totalFrames = width * 2 - 2;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % totalFrames);
    }, 60);
    return () => clearInterval(interval);
  }, [totalFrames]);

  const activePos = frame < width ? frame : (width * 2 - 2 - frame);

  return (
    <div className="flex gap-[1px] items-center">
      {Array.from({ length: width }).map((_, i) => {
        const distance = Math.abs(i - activePos);
        const isActive = distance < trailLength;
        const opacity = isActive ? 1 - (distance / trailLength) * 0.6 : 0.2;
        return (
          <div
            key={i}
            className="w-[5px] h-[5px] rounded-[1px]"
            style={{
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};

type BlockCaretPosition = {
  left: number;
  top: number;
  height: number;
  width: number;
};


type ToolAvailability = {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
};

type AiToolsStatus = {
  fetchedAt?: string;
  cached?: boolean;
  claude: ToolAvailability;
  codex: ToolAvailability;
};

type ToolDisplaySettings = {
  model?: string;
  level?: string;
};

type AiToolSettingsResponse = {
  claude?: { model?: string };
  codex?: { model?: string; reasoningEffort?: string; sandbox?: string; askForApproval?: string };
};

const formatCliVersion = (version?: string): string | undefined => {
  if (!version) return undefined;
  const trimmed = version.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/(\d+\.\d+\.\d+)/);
  return match ? `v${match[1]}` : trimmed;
};

const subtitlePartsForTool = (tool: CLITool, args: { model?: string; level?: string; version?: string }): string[] => {
  if (tool === 'claude') {
    return [args.model, formatCliVersion(args.version)].filter(Boolean) as string[];
  }
  return [args.model, args.level, formatCliVersion(args.version)].filter(Boolean) as string[];
};

const CLISelector: React.FC<{
  selected: CLITool;
  onChange: (tool: CLITool) => void;
  disabled: boolean;
  availability: AiToolsStatus | null;
  availabilityLoading: boolean;
  settingsLoading: boolean;
  settings: Record<CLITool, ToolDisplaySettings>;
  onOpen: () => void;
}> = React.memo(({ selected, onChange, disabled, availability, availabilityLoading, settingsLoading, settings, onOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tools: { id: CLITool; label: string; icon: React.ReactNode }[] = [
    { id: 'claude', label: 'Claude', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'codex', label: 'Codex', icon: <Code2 className="w-3.5 h-3.5" /> },
  ];

  const selectedTool = tools.find(t => t.id === selected) || tools[0];
  const selectedSettings = settings[selected];
  const availabilityForSelected = availability?.[selected];
  const isSelectedAvailable = availabilityLoading ? true : (availabilityForSelected?.available ?? true);
  const selectedSubtitleParts = subtitlePartsForTool(selected, {
    model: selectedSettings.model,
    level: selectedSettings.level,
    version: availabilityForSelected?.version,
  });
  const selectedSubtitle = selectedSubtitleParts.join(' • ') || (settingsLoading ? 'Detecting…' : '');
  const isProbing = availabilityLoading || settingsLoading;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => {
          if (disabled) return;
          const next = !isOpen;
          setIsOpen(next);
          if (next) onOpen();
        }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all st-focus-ring ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer st-hoverable'
        } ${isOpen ? 'st-selected' : ''}`}
        title={!isSelectedAvailable ? (availabilityForSelected?.error || `${selectedTool.label} unavailable`) : undefined}
      >
        {selectedTool.icon}
        <span style={{ color: 'var(--st-text)' }}>{selectedTool.label}</span>
        {selectedSubtitle && (
          <span className="truncate max-w-[320px] st-text-faint" title={selectedSubtitle}>
            {selectedSubtitle}
          </span>
        )}
        {isProbing && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--st-text-faint)' }} />}
        {!availabilityLoading && !isSelectedAvailable && <span className="text-[10px] uppercase tracking-wider st-text-faint">Unavailable</span>}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--st-text-faint)' }} />
      </button>

      {/* Dropdown with animation */}
      <div
        className={`absolute bottom-full left-0 mb-1 border rounded-lg shadow-xl py-1 min-w-[280px] z-50 transition-all origin-bottom relative ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
        }`}
        style={{ transitionDuration: '150ms' }}
      >
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            backgroundColor: 'var(--st-surface)',
            border: '1px solid color-mix(in srgb, var(--st-border) 70%, transparent)',
          }}
        />
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              const toolAvailability = availability?.[tool.id];
              if (!availabilityLoading && toolAvailability && !toolAvailability.available) {
                return;
              }
              onChange(tool.id);
              setIsOpen(false);
            }}
            disabled={!availabilityLoading && !!availability?.[tool.id] && !availability[tool.id].available}
            className={`relative w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors st-focus-ring ${
              selected === tool.id ? 'st-selected' : 'st-hoverable'
            } ${!availabilityLoading && !!availability?.[tool.id] && !availability[tool.id].available ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!availabilityLoading && !availability?.[tool.id]?.available ? (availability?.[tool.id]?.error || `${tool.label} unavailable`) : undefined}
          >
            {tool.icon}
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--st-text)' }}>{tool.label}</span>
                {isProbing && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--st-text-faint)' }} />}
                {!availabilityLoading && availability?.[tool.id]?.available === false && (
                  <span className="text-[10px] uppercase tracking-wider st-text-faint">Unavailable</span>
                )}
              </div>
              {(settings[tool.id]?.model || settings[tool.id]?.level || availability?.[tool.id]?.version || settingsLoading) && (
                <span
                  className="text-[11px] truncate max-w-[260px] st-text-faint"
                  title={subtitlePartsForTool(tool.id, {
                    model: settings[tool.id]?.model,
                    level: settings[tool.id]?.level,
                    version: availability?.[tool.id]?.version,
                  }).join(' • ') || (settingsLoading ? 'Detecting…' : '')}
                >
                  {subtitlePartsForTool(tool.id, {
                    model: settings[tool.id]?.model,
                    level: settings[tool.id]?.level,
                    version: availability?.[tool.id]?.version,
                  }).join(' • ') || (settingsLoading ? 'Detecting…' : '')}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

CLISelector.displayName = 'CLISelector';

export const InputBar: React.FC<InputBarProps> = React.memo(({
  session,
  panelId: _panelId,
  selectedTool,
  onToolChange,
  onSend,
  onCancel,
  isProcessing,
  placeholder = 'Message...',
  focusRequestId
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);
  const [caretPos, setCaretPos] = useState<BlockCaretPosition | null>(null);
  const [aiToolsStatus, setAiToolsStatus] = useState<AiToolsStatus | null>(null);
  const [, setAiToolsLoading] = useState(false);
  const [, setToolSettingsProbeLoading] = useState(true);
  const [, setToolSettingsTimelineLoading] = useState(true);
  const [toolSettings, setToolSettings] = useState<Record<CLITool, ToolDisplaySettings>>({
    claude: {},
    codex: {}
  });
  const [escPending, setEscPending] = useState(false);
  const escTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageIdCounter = useRef(0);

  const getEditorText = useCallback(() => {
    if (!editorRef.current) return '';
    return editorRef.current.innerText || '';
  }, []);

  const checkEmpty = useCallback(() => {
    const text = getEditorText().trim();
    const hasPills = editorRef.current?.querySelector('[data-image-id]') !== null;
    setIsEmpty(!text && !hasPills);
  }, [getEditorText]);

  const insertImageTag = useCallback((index: number, id: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const pill = document.createElement('span');
    pill.textContent = `[Image ${index}]`;
    pill.setAttribute('data-image-id', id);
    pill.setAttribute('contenteditable', 'false');
    pill.style.cssText = `
      display: inline-block;
      padding: 2px 6px;
      margin: 0 2px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      background-color: color-mix(in srgb, var(--st-accent) 15%, transparent);
      border: 1px solid var(--st-accent);
      color: var(--st-accent);
      user-select: all;
      cursor: default;
    `;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pill);
      range.setStartAfter(pill);
      range.setEndAfter(pill);
      
      const space = document.createTextNode(' ');
      range.insertNode(space);
      range.setStartAfter(space);
      range.setEndAfter(space);
      
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.appendChild(pill);
      editor.appendChild(document.createTextNode(' '));
    }
    
    editor.focus();
  }, []);

  const addImageAttachment = useCallback((file: File): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const id = `img-${Date.now()}-${imageIdCounter.current++}`;
        const imageIndex = imageAttachments.length + 1;
        
        setImageAttachments((prev) => [...prev, {
          id,
          filename: file.name || 'image.png',
          mime: file.type || 'image/png',
          dataUrl,
        }]);
        
        insertImageTag(imageIndex, id);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }, [imageAttachments.length, insertImageTag]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const observer = new MutationObserver(() => {
      const currentPills = editor.querySelectorAll('[data-image-id]');
      const currentIds = new Set(Array.from(currentPills).map(p => p.getAttribute('data-image-id')));
      
      setImageAttachments((prev) => prev.filter((img) => currentIds.has(img.id)));
      checkEmpty();
    });

    observer.observe(editor, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [checkEmpty]);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = Array.from(clipboardData.items);
      const imageItems = items.filter((item) => ACCEPTED_IMAGE_TYPES.includes(item.type));

      if (imageItems.length > 0) {
        e.preventDefault();
        for (const item of imageItems) {
          const file = item.getAsFile();
          if (file) await addImageAttachment(file);
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [addImageAttachment]);

  const handleSubmit = useCallback(() => {
    const text = getEditorText().trim();
    if (!text && imageAttachments.length === 0) return;
    if (isProcessing) return;

    onSend(text, imageAttachments.length > 0 ? imageAttachments : undefined);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setImageAttachments([]);
    setIsEmpty(true);
  }, [getEditorText, imageAttachments, isProcessing, onSend]);

  const isRunning = session.status === 'running' || session.status === 'initializing';

  const updateBlockCaret = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isRunning || !isFocused) {
      setCaretPos(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      setCaretPos(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
      setCaretPos(null);
      return;
    }

    const wrapperRect = editor.getBoundingClientRect();
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    if (!rect || (rect.height === 0 && rect.width === 0)) {
      setCaretPos(null);
      return;
    }

    const lineHeightRaw = window.getComputedStyle(editor).lineHeight;
    const lineHeight = Number.isFinite(Number(lineHeightRaw)) ? Number(lineHeightRaw) : rect.height || 18;
    const height = Math.max(14, Math.round(lineHeight));
    const width = Math.max(7, Math.round(height * 0.55));

    setCaretPos({
      left: rect.left - wrapperRect.left,
      top: rect.top - wrapperRect.top,
      height,
      width,
    });
  }, [isFocused, isRunning]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isRunning) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isRunning]);

  useLayoutEffect(() => {
    updateBlockCaret();
  }, [updateBlockCaret, isEmpty, imageAttachments.length, selectedTool]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => updateBlockCaret());
    };

    const onSelectionChange = () => schedule();
    const onScroll = () => schedule();
    const onInput = () => schedule();
    const onKey = () => schedule();
    const onMouse = () => schedule();

    document.addEventListener('selectionchange', onSelectionChange);
    editor.addEventListener('scroll', onScroll);
    editor.addEventListener('input', onInput);
    editor.addEventListener('keydown', onKey);
    editor.addEventListener('keyup', onKey);
    editor.addEventListener('mousedown', onMouse);
    editor.addEventListener('mouseup', onMouse);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('selectionchange', onSelectionChange);
      editor.removeEventListener('scroll', onScroll);
      editor.removeEventListener('input', onInput);
      editor.removeEventListener('keydown', onKey);
      editor.removeEventListener('keyup', onKey);
      editor.removeEventListener('mousedown', onMouse);
      editor.removeEventListener('mouseup', onMouse);
    };
  }, [updateBlockCaret]);

  useEffect(() => {
    if (!isRunning) {
      setEscPending(false);
      if (escTimeoutRef.current) {
        clearTimeout(escTimeoutRef.current);
        escTimeoutRef.current = null;
      }
    }
  }, [isRunning]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRunning) {
        e.preventDefault();
        if (escPending) {
          if (escTimeoutRef.current) {
            clearTimeout(escTimeoutRef.current);
            escTimeoutRef.current = null;
          }
          setEscPending(false);
          onCancel();
        } else {
          setEscPending(true);
          escTimeoutRef.current = setTimeout(() => {
            setEscPending(false);
            escTimeoutRef.current = null;
          }, 5000);
        }
      }
    };
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const tools: CLITool[] = ['claude', 'codex'];
      const currentIndex = tools.indexOf(selectedTool);
      const nextIndex = (currentIndex + 1) % tools.length;
      onToolChange(tools[nextIndex]);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('keydown', handleTabKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('keydown', handleTabKey, { capture: true });
    };
  }, [isRunning, escPending, onCancel, selectedTool, onToolChange]);

  useEffect(() => {
    if (!focusRequestId) return;
    editorRef.current?.focus();
  }, [focusRequestId]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const loadAvailability = useCallback(async (force?: boolean) => {
    setAiToolsLoading(true);
    try {
      const res = await API.aiTools.getStatus({ force });
      if (res.success && res.data) {
        setAiToolsStatus(res.data as AiToolsStatus);
      }
    } finally {
      setAiToolsLoading(false);
    }
  }, []);

  const applyTimelineEventToSettings = useCallback((event: TimelineEvent) => {
    if (event.kind !== 'cli.command') return;
    if (event.tool !== 'claude' && event.tool !== 'codex') return;
    const meta = (event.meta || {}) as Record<string, unknown>;
    const cliModel = typeof meta.cliModel === 'string' ? meta.cliModel : undefined;
    const cliReasoningEffort = typeof meta.cliReasoningEffort === 'string' ? meta.cliReasoningEffort : undefined;

    setToolSettings((prev) => {
      const next = { ...prev };
      if (event.tool === 'claude') {
        next.claude = {
          ...next.claude,
          model: cliModel ?? next.claude.model,
        };
      } else {
        next.codex = {
          ...next.codex,
          model: cliModel ?? next.codex.model,
          level: cliReasoningEffort ?? next.codex.level,
        };
      }
      return next;
    });
  }, []);

  const loadToolSettingsFromProbe = useCallback(async () => {
    setToolSettingsProbeLoading(true);
    try {
      const res = await withTimeout(API.aiTools.getSettings(), 8_000, 'Detect CLI settings');
      if (!res.success || !res.data) return;
      const data = res.data as AiToolSettingsResponse;
      setToolSettings((prev) => ({
        claude: {
          model: typeof data.claude?.model === 'string' ? data.claude?.model : prev.claude.model,
        },
        codex: {
          model: typeof data.codex?.model === 'string' ? data.codex?.model : prev.codex.model,
          level: typeof data.codex?.reasoningEffort === 'string' ? data.codex?.reasoningEffort : prev.codex.level,
        },
      }));
    } catch {
      // ignore transient probe errors
    } finally {
      setToolSettingsProbeLoading(false);
    }
  }, []);

  const loadToolSettingsFromTimeline = useCallback(async () => {
    setToolSettingsTimelineLoading(true);
    try {
      const res = await withTimeout(API.sessions.getTimeline(session.id), 8_000, 'Load runtime settings');
      if (!res.success || !Array.isArray(res.data)) return;
      const events = res.data as TimelineEvent[];

      let lastClaude: TimelineEvent | null = null;
      let lastCodex: TimelineEvent | null = null;
      for (const e of events) {
        if (e.kind !== 'cli.command') continue;
        if (e.tool === 'claude') lastClaude = e;
        if (e.tool === 'codex') lastCodex = e;
      }
      if (lastClaude) applyTimelineEventToSettings(lastClaude);
      if (lastCodex) applyTimelineEventToSettings(lastCodex);
    } catch {
      // ignore transient probe errors
    } finally {
      setToolSettingsTimelineLoading(false);
    }
  }, [session.id, applyTimelineEventToSettings]);

  useEffect(() => {
    // Probe once per workspace to populate model/level even before the first run.
    void loadToolSettingsFromProbe();
    loadToolSettingsFromTimeline();
  }, [loadToolSettingsFromProbe, loadToolSettingsFromTimeline]);

  useEffect(() => {
    if (!window.electronAPI?.events?.onTimelineEvent) return;
    const unsubscribe = window.electronAPI.events.onTimelineEvent((data) => {
      if (data.sessionId !== session.id) return;
      const event = data.event as TimelineEvent | undefined;
      if (!event) return;
      applyTimelineEventToSettings(event);
    });
    return () => unsubscribe();
  }, [session.id, applyTimelineEventToSettings]);



  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const agentColor = selectedTool === 'claude' ? '#c678dd' : '#56b6c2';
  const agentName = selectedTool === 'claude' ? 'Claude' : 'Codex';
  const selectedSettings = toolSettings[selectedTool];
  const availabilityForSelected = aiToolsStatus?.[selectedTool];
  const modelInfo = selectedSettings.model || '';
  const levelInfo = selectedTool === 'codex' && selectedSettings.level ? selectedSettings.level : '';
  const versionInfo = formatCliVersion(availabilityForSelected?.version) || '';

  return (
    <div className="flex-shrink-0 px-4 py-2" style={{ backgroundColor: 'var(--st-bg)' }}>
      <div className="flex">
        <div
          className="w-[2px] self-stretch transition-colors duration-150"
          style={{ backgroundColor: isFocused || isRunning ? agentColor : 'var(--st-border-variant)' }}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="ml-2 px-3 py-2"
            style={{ backgroundColor: 'var(--st-editor)' }}
          >
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                onKeyDown={handleKeyDown}
                onInput={checkEmpty}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full bg-transparent text-[13px] font-mono focus:outline-none min-h-[20px] max-h-[144px] overflow-y-auto scrollbar-thin"
                style={{
                  color: isRunning ? 'var(--st-text-faint)' : 'var(--st-text)',
                  caretColor: isRunning ? 'transparent' : 'var(--st-text)',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              />
              {!isRunning && isFocused && caretPos && (
                <div
                  aria-hidden="true"
                  className="st-block-caret pointer-events-none absolute"
                  style={{
                    left: caretPos.left,
                    top: caretPos.top,
                    width: caretPos.width,
                    height: caretPos.height,
                    backgroundColor: 'color-mix(in srgb, var(--st-text) 35%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--st-text) 55%, transparent)',
                    borderRadius: 2,
                    animation: 'stCaretBlink 1s steps(1, end) infinite',
                  }}
                />
              )}
              {isEmpty && !isRunning && (
                <div
                  className="absolute top-0 left-0 text-[13px] font-mono pointer-events-none"
                  style={{ color: 'var(--st-text-faint)', opacity: 0.6 }}
                >
                  {placeholder}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 text-[12px]">
              <span style={{ color: agentColor }}>{agentName}</span>
              {modelInfo && (
                <span style={{ color: 'var(--st-text)' }}>{modelInfo}</span>
              )}
              {levelInfo && (
                <span style={{ color: 'var(--st-text-faint)' }}>{levelInfo}</span>
              )}
              {versionInfo && (
                <span style={{ color: 'var(--st-text-faint)' }}>{versionInfo}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between ml-2 mt-2 text-[11px]">
            <div className="flex items-center gap-2">
              {isRunning && (
                <>
                  <KnightRiderSpinner color={agentColor} />
                  <span style={{ color: escPending ? 'var(--st-accent)' : 'var(--st-text)' }}>
                    esc{' '}
                    <span style={{ color: escPending ? 'var(--st-accent)' : 'var(--st-text-faint)' }}>
                      {escPending ? 'again to interrupt' : 'interrupt'}
                    </span>
                  </span>
                </>
              )}
            </div>
            <span style={{ color: 'var(--st-text)' }}>
              tab{' '}
              <span style={{ color: 'var(--st-text-faint)' }}>switch agent</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

InputBar.displayName = 'InputBar';

export default InputBar;
