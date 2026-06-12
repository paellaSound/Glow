'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getVisualArt } from 'glow-visuals';
import type { VisualArtId } from 'glow-visuals';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Plus,
  Trash2,
  Settings,
  Music,
  Palette,
  Layers,
  Upload,
  ChevronUp,
  ChevronDown,
  Globe,
  Check,
  AlertCircle,
  X,
  FileImage,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  NeonButton,
  NeonCard,
  NeonTitle,
  PageTransitionWrapper,
  SectionGlow,
} from '@/components/ui/neon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorPaletteField, validatePalette } from '@/components/glow/color-palette-field';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Cue = {
  id: string;
  visualArtId: string;
  sortOrder: number;
  params?: Record<string, unknown>;
  transition?: { type: 'cut' | 'fade'; durationMs: number };
  label?: string | null;
};

type Social = {
  id: string;
  kind: string;
  label?: string | null;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

type Rig = {
  id: string;
  name: string;
  defaultVisualArtId: string;
  palette: string[];
  logoAssetPath: string | null;
  logoEnabled: boolean;
  consoleConfig: {
    visibleTabs?: Array<'devices' | 'visuals'>;
    hiddenButtons?: string[];
    [key: string]: any;
  };
  metadata: Record<string, any>;
  schemaVersion: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  cues?: Cue[];
  socials?: Social[];
};

type UserApiResponse = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  entitlements: {
    maxRigs: number;
    availableVisualArts: string[];
    visualsSurface: boolean;
    [key: string]: any;
  } | null;
};

type FormValues = {
  name: string;
  defaultVisualArtId: string;
  palette: string[];
  logoEnabled: boolean;
  isDefault: boolean;
  cues: Omit<Cue, 'id'>[];
  socials: Omit<Social, 'id'>[];
  consoleTabs: string[];
  qrEnabled: boolean;
  qrInterval: number;
  qrDuration: number;
  logoPosition: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoEffect: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  logoOpacity: number;
  displayName: string;
};

const SOCIAL_KINDS = [
  { value: 'soundcloud', label: 'SoundCloud' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'beatport', label: 'Beatport' },
  { value: 'mixcloud', label: 'Mixcloud' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other / Link' },
];

const VISUAL_ART_LABELS: Record<string, string> = {
  'audio-shader': 'WebGL Audio Shader',
};

export default function RigsPage() {
  const router = useRouter();
  const { data: userData } = useSWR<UserApiResponse>('/api/user', fetcher);
  const { data: rigsList, mutate: mutateRigs } = useSWR<Rig[]>('/api/rigs', fetcher);

  const [editingRig, setEditingRig] = useState<Rig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'cues' | 'socials' | 'console'>('info');

  const [originalValues, setOriginalValues] = useState<FormValues | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDefaultArt, setFormDefaultArt] = useState('audio-shader');
  const [formPalette, setFormPalette] = useState<string[]>(['#FF0055', '#00FFCC']);
  const [formLogoEnabled, setFormLogoEnabled] = useState(false);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formCues, setFormCues] = useState<Omit<Cue, 'id'>[]>([]);
  const [formSocials, setFormSocials] = useState<Omit<Social, 'id'>[]>([]);
  const [formConsoleTabs, setFormConsoleTabs] = useState<string[]>(['devices', 'visuals']);

  // QR config states
  const [formQrEnabled, setFormQrEnabled] = useState(false);
  const [formQrInterval, setFormQrInterval] = useState(30);
  const [formQrDuration, setFormQrDuration] = useState(5);

  // Logo config states
  const [formLogoPosition, setFormLogoPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('center');
  const [formLogoEffect, setFormLogoEffect] = useState<'none' | 'pulse' | 'spin' | 'float' | 'neon'>('none');
  const [formLogoOpacity, setFormLogoOpacity] = useState(0.8);

  // Preview mock QR state
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string | null>(null);
  const [showPreviewQr, setShowPreviewQr] = useState(false);

  // File upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const userId = userData?.user?.id;
  const draftKey = userId ? `glow_rig_draft_${userId}` : null;

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!draftKey) {
      setHasDraft(false);
      setDraftData(null);
      return;
    }
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraftData(parsed);
        setHasDraft(true);
      } else {
        setHasDraft(false);
        setDraftData(null);
      }
    } catch (e) {
      console.error('Failed to parse draft', e);
    }
  }, [draftKey]);

  // Restore and Discard Draft helpers
  const restoreDraft = () => {
    if (!draftData) return;
    
    if (draftData.isCreating) {
      setIsCreating(true);
      setEditingRig(null);
    } else {
      const rig = rigsList?.find(r => r.id === draftData.editingRigId) || { id: draftData.editingRigId } as any;
      setEditingRig(rig);
      setIsCreating(false);
    }

    const vals = draftData.values;
    setFormName(vals.name || '');
    setFormDisplayName(vals.displayName || '');
    setFormDefaultArt(vals.defaultVisualArtId || 'audio-shader');
    setFormPalette(vals.palette || ['#FF0055', '#00FFCC']);
    setFormLogoEnabled(vals.logoEnabled ?? false);
    setFormIsDefault(vals.isDefault ?? false);
    setFormCues(vals.cues || []);
    setFormSocials(vals.socials || []);
    setFormConsoleTabs(vals.consoleTabs || ['devices', 'visuals']);
    setFormQrEnabled(vals.qrEnabled ?? false);
    setFormQrInterval(vals.qrInterval ?? 30);
    setFormQrDuration(vals.qrDuration ?? 5);
    setFormLogoPosition(vals.logoPosition || 'center');
    setFormLogoEffect(vals.logoEffect || 'none');
    setFormLogoOpacity(vals.logoOpacity ?? 0.8);
    setLogoFile(null);

    // Reconstruct original values for comparison
    if (draftData.isCreating) {
      setOriginalValues({
        name: 'New Rig Set',
        displayName: '',
        defaultVisualArtId: 'audio-shader',
        palette: ['#FF0055', '#00FFCC'],
        logoEnabled: false,
        isDefault: false,
        cues: [],
        socials: [],
        consoleTabs: ['devices', 'visuals'],
        qrEnabled: false,
        qrInterval: 30,
        qrDuration: 5,
        logoPosition: 'center',
        logoEffect: 'none',
        logoOpacity: 0.8
      });
    } else {
      const originalRig = rigsList?.find(r => r.id === draftData.editingRigId);
      if (originalRig) {
        const qr = originalRig.consoleConfig?.qrConfig;
        const logoConfig = originalRig.consoleConfig?.logoConfig;
        setOriginalValues({
          name: originalRig.name,
          displayName: originalRig.consoleConfig?.displayName || '',
          defaultVisualArtId: originalRig.defaultVisualArtId,
          palette: originalRig.palette,
          logoEnabled: originalRig.logoEnabled,
          isDefault: originalRig.isDefault,
          cues: originalRig.cues ? originalRig.cues.map(c => ({
            visualArtId: c.visualArtId,
            sortOrder: c.sortOrder,
            params: c.params,
            transition: c.transition,
            label: c.label,
          })) : [],
          socials: originalRig.socials ? originalRig.socials.map(s => ({
            kind: s.kind,
            label: s.label,
            url: s.url,
            enabled: s.enabled,
            sortOrder: s.sortOrder,
          })) : [],
          consoleTabs: originalRig.consoleConfig?.visibleTabs ?? ['devices', 'visuals'],
          qrEnabled: qr?.enabled ?? false,
          qrInterval: qr?.intervalSeconds ?? 30,
          qrDuration: qr?.durationSeconds ?? 5,
          logoPosition: logoConfig?.position ?? 'center',
          logoEffect: logoConfig?.effect ?? 'none',
          logoOpacity: logoConfig?.opacity ?? 0.8,
        });
      } else {
        setOriginalValues({
          name: vals.name,
          displayName: vals.displayName || '',
          defaultVisualArtId: vals.defaultVisualArtId,
          palette: vals.palette,
          logoEnabled: vals.logoEnabled,
          isDefault: vals.isDefault,
          cues: vals.cues,
          socials: vals.socials,
          consoleTabs: vals.consoleTabs,
          qrEnabled: vals.qrEnabled,
          qrInterval: vals.qrInterval,
          qrDuration: vals.qrDuration,
          logoPosition: vals.logoPosition,
          logoEffect: vals.logoEffect,
          logoOpacity: vals.logoOpacity,
        });
      }
    }

    setHasDraft(false);
    toast.success('Unsaved draft restored successfully!');
  };

  const discardDraft = () => {
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
    setDraftData(null);
    setHasDraft(false);
    toast.success('Unsaved draft discarded.');
  };

  // Form dirty check logic
  const isFormDirty = useMemo(() => {
    if (!originalValues) return false;
    if (formName !== originalValues.name) return true;
    if (formDisplayName !== originalValues.displayName) return true;
    if (formDefaultArt !== originalValues.defaultVisualArtId) return true;
    if (JSON.stringify(formPalette) !== JSON.stringify(originalValues.palette)) return true;
    if (formLogoEnabled !== originalValues.logoEnabled) return true;
    if (formIsDefault !== originalValues.isDefault) return true;
    if (JSON.stringify(formCues) !== JSON.stringify(originalValues.cues)) return true;
    if (JSON.stringify(formSocials) !== JSON.stringify(originalValues.socials)) return true;
    if (JSON.stringify(formConsoleTabs.sort()) !== JSON.stringify([...originalValues.consoleTabs].sort())) return true;
    if (formQrEnabled !== originalValues.qrEnabled) return true;
    if (formQrInterval !== originalValues.qrInterval) return true;
    if (formQrDuration !== originalValues.qrDuration) return true;
    if (formLogoPosition !== originalValues.logoPosition) return true;
    if (formLogoEffect !== originalValues.logoEffect) return true;
    if (formLogoOpacity !== originalValues.logoOpacity) return true;
    if (logoFile !== null) return true;
    return false;
  }, [
    originalValues,
    formName,
    formDisplayName,
    formDefaultArt,
    formPalette,
    formLogoEnabled,
    formIsDefault,
    formCues,
    formSocials,
    formConsoleTabs,
    formQrEnabled,
    formQrInterval,
    formQrDuration,
    formLogoPosition,
    formLogoEffect,
    formLogoOpacity,
    logoFile,
  ]);

  // Save draft to localStorage dynamically upon change
  useEffect(() => {
    if (!isCreating && !editingRig) return;
    if (!originalValues) return;
    if (!draftKey) return;

    const draft = {
      editingRigId: editingRig?.id || null,
      isCreating,
      values: {
        name: formName,
        displayName: formDisplayName,
        defaultVisualArtId: formDefaultArt,
        palette: formPalette,
        logoEnabled: formLogoEnabled,
        isDefault: formIsDefault,
        cues: formCues,
        socials: formSocials,
        consoleTabs: formConsoleTabs,
        qrEnabled: formQrEnabled,
        qrInterval: formQrInterval,
        qrDuration: formQrDuration,
        logoPosition: formLogoPosition,
        logoEffect: formLogoEffect,
        logoOpacity: formLogoOpacity,
      }
    };

    if (isFormDirty) {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [
    isCreating,
    editingRig,
    originalValues,
    isFormDirty,
    draftKey,
    formName,
    formDisplayName,
    formDefaultArt,
    formPalette,
    formLogoEnabled,
    formIsDefault,
    formCues,
    formSocials,
    formConsoleTabs,
    formQrEnabled,
    formQrInterval,
    formQrDuration,
    formLogoPosition,
    formLogoEffect,
    formLogoOpacity,
  ]);

  // Form validation errors reactive memo
  const formErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!formName.trim()) {
      errors.name = 'Rig name is required.';
    } else if (formName.length > 50) {
      errors.name = 'Rig name must be 50 characters or less.';
    }

    Object.assign(errors, validatePalette(formPalette, 4));

    if (formQrEnabled && formQrDuration > 0) {
      if (formQrInterval < 10) {
        errors.qrInterval = 'Interval must be at least 10 seconds.';
      }
      if (formQrDuration < 2) {
        errors.qrDuration = 'Duration must be at least 2 seconds.';
      }
      if (formQrDuration >= formQrInterval) {
        errors.qrDuration = 'Duration must be less than interval.';
      }
    }

    formCues.forEach((cue, idx) => {
      if (!cue.label?.trim()) {
        errors[`cue_label_${idx}`] = 'Cue label is required.';
      } else if (cue.label.length > 30) {
        errors[`cue_label_${idx}`] = 'Label must be 30 chars or less.';
      }
      if (cue.transition?.type !== 'cut') {
        const dur = cue.transition?.durationMs ?? 1000;
        if (dur < 100 || dur > 10000) {
          errors[`cue_duration_${idx}`] = 'Must be between 100ms and 10000ms.';
        }
      }
    });

    formSocials.forEach((social, idx) => {
      if (social.enabled) {
        if (!social.url.trim()) {
          errors[`social_url_${idx}`] = 'URL link is required.';
        } else {
          try {
            new URL(social.url);
          } catch {
            errors[`social_url_${idx}`] = 'Must be a valid absolute URL (https://...).';
          }
        }
        if (social.kind === 'other' && !social.label?.trim()) {
          errors[`social_label_${idx}`] = 'Label is required for other link.';
        }
      }
    });

    return errors;
  }, [
    formName,
    formPalette,
    formQrEnabled,
    formQrInterval,
    formQrDuration,
    formCues,
    formSocials,
  ]);

  // Tab errors indicator helper
  const tabErrors = useMemo(() => {
    const info = Object.keys(formErrors).some(k => k === 'name' || k === 'palette' || k.startsWith('palette_') || k === 'qrInterval' || k === 'qrDuration');
    const cues = Object.keys(formErrors).some(k => k.startsWith('cue_'));
    const socials = Object.keys(formErrors).some(k => k.startsWith('social_'));
    return { info, cues, socials };
  }, [formErrors]);

  // Live preview state
  const [previewArtId, setPreviewArtId] = useState<VisualArtId | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation loop for preview
  useEffect(() => {
    if (!previewArtId || !previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const definition = getVisualArt(previewArtId);
    if (!definition) return;
    
    let animationFrameId: number;
    let startTime = Date.now();
    
    const mockInput = {
      timeMs: 0,
      palette: formPalette,
      roomCode: 'PREVIEW',
      audio: {
        bass: 0.2,
        mid: 0.1,
        treble: 0.1,
        energy: 0.15,
      }
    };
    
    const controller = definition.mount(canvas, () => mockInput);
    
    const tick = () => {
      const elapsed = Date.now() - startTime;
      mockInput.timeMs = elapsed;
      
      // Simulate audio pulses
      const t = elapsed / 1000;
      mockInput.audio = {
        bass: 0.2 + Math.sin(t * 8) * 0.15 + Math.cos(t * 15) * 0.05,
        mid: 0.2 + Math.cos(t * 6) * 0.15,
        treble: 0.1 + Math.sin(t * 14) * 0.1,
        energy: 0.15 + Math.sin(t * 4) * 0.1,
      };
      
      animationFrameId = requestAnimationFrame(tick);
    };
    
    tick();
    
    const handleResize = () => {
      controller?.resize();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controller?.destroy();
    };
  }, [previewArtId, formPalette]);

  // Generate mock Join QR for Preview Modal
  useEffect(() => {
    QRCode.toDataURL('https://glotherave.app/room/PREVIEW/play', {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setPreviewQrDataUrl);
  }, []);

  // Periodic preview QR overlay display cycle
  useEffect(() => {
    if (!previewArtId || !formQrEnabled) {
      setShowPreviewQr(false);
      return;
    }

    if (formQrDuration === 0) {
      setShowPreviewQr(true);
      return;
    }

    const intervalMs = formQrInterval * 1000;
    const durationMs = formQrDuration * 1000;

    let showTimeout: NodeJS.Timeout;
    let hideTimeout: NodeJS.Timeout;

    const startCycle = () => {
      showTimeout = setTimeout(() => {
        setShowPreviewQr(true);
        hideTimeout = setTimeout(() => {
          setShowPreviewQr(false);
          startCycle();
        }, durationMs);
      }, intervalMs);
    };

    startCycle();
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [previewArtId, formQrEnabled, formQrInterval, formQrDuration]);

  const entitlements = userData?.entitlements;
  const maxRigs = entitlements?.maxRigs ?? 1;
  const availableArts = entitlements?.availableVisualArts ?? ['audio-shader'];

  const openEdit = (rig: Rig) => {
    setEditingRig(rig);
    setIsCreating(false);
    setFormName(rig.name);
    setFormDisplayName(rig.consoleConfig?.displayName || '');
    setFormDefaultArt(rig.defaultVisualArtId);
    setFormPalette(rig.palette);
    setFormLogoEnabled(rig.logoEnabled);
    setFormIsDefault(rig.isDefault);
    
    const formattedCues = rig.cues ? rig.cues.map(c => ({
      visualArtId: c.visualArtId,
      sortOrder: c.sortOrder,
      params: c.params,
      transition: c.transition,
      label: c.label,
    })) : [];
    setFormCues(formattedCues);

    const formattedSocials = rig.socials ? rig.socials.map(s => ({
      kind: s.kind,
      label: s.label,
      url: s.url,
      enabled: s.enabled,
      sortOrder: s.sortOrder,
    })) : [];
    setFormSocials(formattedSocials);

    const visibleTabs = rig.consoleConfig?.visibleTabs ?? ['devices', 'visuals'];
    setFormConsoleTabs(visibleTabs);

    const qr = rig.consoleConfig?.qrConfig;
    const qrEnabledVal = qr?.enabled ?? false;
    const qrIntervalVal = qr?.intervalSeconds ?? 30;
    const qrDurationVal = qr?.durationSeconds ?? 5;
    setFormQrEnabled(qrEnabledVal);
    setFormQrInterval(qrIntervalVal);
    setFormQrDuration(qrDurationVal);

    const logoConfig = rig.consoleConfig?.logoConfig;
    const logoPositionVal = logoConfig?.position ?? 'center';
    const logoEffectVal = logoConfig?.effect ?? 'none';
    const logoOpacityVal = logoConfig?.opacity ?? 0.8;
    setFormLogoPosition(logoPositionVal);
    setFormLogoEffect(logoEffectVal);
    setFormLogoOpacity(logoOpacityVal);

    setLogoFile(null);
    setActiveTab('info');

    // Store original values for dirty checking comparison
    setOriginalValues({
      name: rig.name,
      displayName: rig.consoleConfig?.displayName || '',
      defaultVisualArtId: rig.defaultVisualArtId,
      palette: rig.palette,
      logoEnabled: rig.logoEnabled,
      isDefault: rig.isDefault,
      cues: formattedCues,
      socials: formattedSocials,
      consoleTabs: visibleTabs,
      qrEnabled: qrEnabledVal,
      qrInterval: qrIntervalVal,
      qrDuration: qrDurationVal,
      logoPosition: logoPositionVal,
      logoEffect: logoEffectVal,
      logoOpacity: logoOpacityVal,
    });
  };

  const openCreate = () => {
    if (rigsList && rigsList.length >= maxRigs) {
      toast.error(`Plan limit reached! Free plan allows only ${maxRigs} rig. Upgrade in Billing.`);
      return;
    }
    setEditingRig(null);
    setIsCreating(true);
    setFormName('New Rig Set');
    setFormDisplayName('');
    setFormDefaultArt('audio-shader');
    setFormPalette(['#FF0055', '#00FFCC']);
    setFormLogoEnabled(false);
    
    const isFirstRig = rigsList?.length === 0;
    setFormIsDefault(isFirstRig);
    
    setFormCues([]);
    setFormSocials([]);
    setFormConsoleTabs(['devices', 'visuals']);
    setFormQrEnabled(false);
    setFormQrInterval(30);
    setFormQrDuration(5);
    setFormLogoPosition('center');
    setFormLogoEffect('none');
    setFormLogoOpacity(0.8);
    setLogoFile(null);
    setActiveTab('info');

    // Store original values for new rig defaults
    setOriginalValues({
      name: 'New Rig Set',
      displayName: '',
      defaultVisualArtId: 'audio-shader',
      palette: ['#FF0055', '#00FFCC'],
      logoEnabled: false,
      isDefault: isFirstRig,
      cues: [],
      socials: [],
      consoleTabs: ['devices', 'visuals'],
      qrEnabled: false,
      qrInterval: 30,
      qrDuration: 5,
      logoPosition: 'center',
      logoEffect: 'none',
      logoOpacity: 0.8,
    });
  };

  const closeForm = () => {
    if (isFormDirty) {
      if (!confirm('You have unsaved changes. Discard draft and exit?')) {
        return;
      }
    }
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
    setOriginalValues(null);
    setEditingRig(null);
    setIsCreating(false);
  };

  // Cue Helpers
  const addCue = () => {
    const defaultArt = availableArts[0] || 'audio-shader';
    setFormCues([...formCues, {
      visualArtId: defaultArt,
      sortOrder: formCues.length,
      params: {},
      transition: { type: 'fade', durationMs: 1000 },
      label: `Cue ${formCues.length + 1}`,
    }]);
  };

  const removeCue = (idx: number) => {
    const filtered = formCues.filter((_, i) => i !== idx);
    setFormCues(filtered.map((c, i) => ({ ...c, sortOrder: i })));
  };

  const updateCueField = (idx: number, field: string, value: any) => {
    const updated = [...formCues];
    if (field === 'transition.type') {
      updated[idx] = {
        ...updated[idx],
        transition: { type: value, durationMs: updated[idx].transition?.durationMs ?? 1000 }
      };
    } else if (field === 'transition.durationMs') {
      updated[idx] = {
        ...updated[idx],
        transition: { type: updated[idx].transition?.type ?? 'fade', durationMs: Number(value) }
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setFormCues(updated);
  };

  const moveCue = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === formCues.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...formCues];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setFormCues(updated.map((c, i) => ({ ...c, sortOrder: i })));
  };

  // Social Helpers
  const addSocial = () => {
    setFormSocials([...formSocials, {
      kind: 'instagram',
      label: '',
      url: '',
      enabled: true,
      sortOrder: formSocials.length,
    }]);
  };

  const removeSocial = (idx: number) => {
    const filtered = formSocials.filter((_, i) => i !== idx);
    setFormSocials(filtered.map((s, i) => ({ ...s, sortOrder: i })));
  };

  const updateSocialField = (idx: number, field: string, value: any) => {
    const updated = [...formSocials];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormSocials(updated);
  };

  // Console Preference Helpers
  const toggleConsoleTab = (tab: 'devices' | 'visuals') => {
    if (formConsoleTabs.includes(tab)) {
      if (formConsoleTabs.length > 1) {
        setFormConsoleTabs(formConsoleTabs.filter(t => t !== tab));
      } else {
        toast.error('You must keep at least one tab visible!');
      }
    } else {
      setFormConsoleTabs([...formConsoleTabs, tab]);
    }
  };

  // Save handling
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a name for the Rig');
      return;
    }

    try {
      let rigId = editingRig?.id;
      const rigPayload = {
        name: formName,
        defaultVisualArtId: formDefaultArt,
        palette: formPalette,
        logoEnabled: formLogoEnabled,
        isDefault: formIsDefault,
        consoleConfig: {
          visibleTabs: formConsoleTabs as Array<'devices' | 'visuals'>,
          displayName: formDisplayName,
          qrConfig: {
            enabled: formQrEnabled,
            intervalSeconds: Number(formQrInterval),
            durationSeconds: Number(formQrDuration),
          },
          logoConfig: {
            position: formLogoPosition,
            effect: formLogoEffect,
            opacity: Number(formLogoOpacity),
          },
        },
      };

      if (isCreating) {
        // Create Rig
        const res = await fetch('/api/rigs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rigPayload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create rig');
        }

        const newRig = await res.json();
        rigId = newRig.id;
      } else {
        // Update Rig Details
        const res = await fetch(`/api/rigs/${rigId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rigPayload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update rig');
        }
      }

      // Save Cues
      const cuesRes = await fetch(`/api/rigs/${rigId}/cues`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cues: formCues }),
      });

      if (!cuesRes.ok) {
        throw new Error('Failed to save rig cues');
      }

      // Save Socials
      const socialsRes = await fetch(`/api/rigs/${rigId}/socials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socials: formSocials }),
      });

      if (!socialsRes.ok) {
        throw new Error('Failed to save rig socials');
      }

      // Upload Logo if selected
      if (logoFile) {
        setUploadingLogo(true);
        const logoData = new FormData();
        logoData.append('file', logoFile);

        const logoRes = await fetch(`/api/rigs/${rigId}/logo`, {
          method: 'POST',
          body: logoData,
        });

        setUploadingLogo(false);
        if (!logoRes.ok) {
          const err = await logoRes.json();
          toast.error(err.error || 'Failed to upload logo image');
        }
      }

      toast.success(isCreating ? 'Rig created successfully!' : 'Rig updated successfully!');
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }
      setOriginalValues(null);
      mutateRigs();
      setEditingRig(null);
      setIsCreating(false);
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while saving');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/rigs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete rig');
      toast.success('Rig deleted');
      mutateRigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete rig');
    }
  };

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-12 min-h-screen overflow-hidden pb-24">
      <SectionGlow glowColor="mixed" position="top" />

      <PageTransitionWrapper>
        {/* Header */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <NeonTitle as="h1" color="cyan" className="text-3xl font-black tracking-widest">
              RIGS CONFIGURATION
            </NeonTitle>
            <p className="mt-1 text-xs font-cyber tracking-wider text-muted-foreground uppercase">
              Manage your DJ performance sets · limit:{' '}
              <span className="text-neon-cyan neon-text-cyan">
                {rigsList?.length ?? 0}/{maxRigs}
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/room/new">
              <NeonButton color="cyan" variant="outline" className="h-9 text-xs uppercase tracking-widest px-4">
                Back
              </NeonButton>
            </Link>
            <NeonButton
              color="magenta"
              variant="solid"
              onClick={openCreate}
              className="h-9 text-xs uppercase tracking-widest px-4"
            >
              <Plus className="size-4 mr-1" /> New Rig
            </NeonButton>
          </div>
        </div>

        {hasDraft && draftData && (
          <div className="mb-8 p-6 rounded-2xl border border-neon-magenta/30 bg-neon-magenta/5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <span className="font-cyber font-black tracking-widest text-xs text-neon-magenta neon-text-magenta uppercase block">
                Unsaved Draft Found
              </span>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                You have an unsaved configuration draft for: <strong className="text-foreground">{draftData.values.name || 'New Rig'}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <NeonButton
                color="magenta"
                variant="solid"
                onClick={restoreDraft}
                className="h-9 text-[10px] uppercase tracking-widest px-4"
              >
                Restore Draft
              </NeonButton>
              <button
                onClick={discardDraft}
                className="px-4 py-2 text-[10px] font-cyber uppercase tracking-widest border border-border/40 hover:border-red-500 hover:text-red-500 rounded-full transition duration-300 cursor-pointer text-muted-foreground"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Dashboard / Editor Split */}
        {!isCreating && !editingRig ? (
          // --- List View ---
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rigsList?.map((rig) => (
              <NeonCard
                key={rig.id}
                glowColor={rig.isDefault ? 'cyan' : 'none'}
                borderVariant={rig.isDefault ? 'cyan' : 'default'}
                className="flex flex-col justify-between p-6 min-h-[260px] transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className={`font-display uppercase tracking-wider text-lg font-black truncate max-w-[70%] ${rig.isDefault ? 'text-neon-cyan neon-text-cyan' : 'text-foreground'}`}>
                      {rig.name}
                    </h3>
                    {rig.isDefault && (
                      <span className="flex items-center gap-1 text-[9px] font-cyber tracking-widest bg-neon-cyan/20 border border-neon-cyan text-neon-cyan px-2 py-0.5 rounded-full uppercase leading-none">
                        <Star className="size-2.5 fill-neon-cyan" /> DEFAULT
                      </span>
                    )}
                  </div>

                  {/* Colors Preview */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                      {rig.palette.map((color, i) => (
                        <div
                          key={i}
                          className="size-6 rounded-full border border-white/20 shadow-md transition hover:scale-110"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    {rig.logoAssetPath && rig.logoEnabled && (
                      <div className="size-8 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0" title="Branding Logo">
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/rig-logos/${rig.logoAssetPath}`}
                          alt="Logo"
                          className="size-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rig details */}
                  <div className="space-y-1 text-xs text-muted-foreground font-cyber uppercase tracking-wider mb-6">
                    <div className="flex justify-between">
                      <span>Art:</span>
                      <span className="text-foreground font-bold">{VISUAL_ART_LABELS[rig.defaultVisualArtId] || rig.defaultVisualArtId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cues:</span>
                      <span className="text-foreground font-bold">{rig.cues?.length ?? 0} active</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Links:</span>
                      <span className="text-foreground font-bold">{rig.socials?.length ?? 0} active</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <NeonButton
                    color="cyan"
                    variant="outline"
                    onClick={() => openEdit(rig)}
                    className="flex-1 h-9 text-xs uppercase tracking-widest px-2"
                  >
                    <Settings className="size-3.5 mr-1" /> Configure
                  </NeonButton>
                  <button
                    onClick={() => handleDelete(rig.id, rig.name)}
                    className="flex size-9 items-center justify-center rounded-full border border-red-500/20 hover:border-red-500 bg-red-500/5 hover:bg-red-500/20 text-red-500/80 hover:text-red-500 transition-all duration-300 cursor-pointer"
                    title="Delete Rig"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </NeonCard>
            ))}

            {rigsList?.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <AlertCircle className="size-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground uppercase font-cyber tracking-widest">
                  No Rigs saved. Click "New Rig" to create your first setup!
                </p>
              </div>
            )}
          </div>
        ) : (
          // --- Editor Form View ---
          <NeonCard glowColor="magenta" borderVariant="magenta" hoverEffect={false} className="p-8 max-w-3xl mx-auto border-neon-magenta/20">
            {/* Form Title */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
              <NeonTitle as="h2" color="magenta" className="text-xl font-black tracking-widest">
                {isCreating ? 'CREATE NEW RIG' : `CONFIGURE: ${editingRig?.name}`}
              </NeonTitle>
              <button
                onClick={closeForm}
                className="flex size-8 items-center justify-center rounded-full border border-border/60 hover:border-foreground text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tab switchers */}
            <div className="flex border-b border-black/5 dark:border-white/5 mb-6 text-xs font-cyber tracking-widest uppercase">
              <button
                onClick={() => setActiveTab('info')}
                className={`pb-2.5 px-4 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'info'
                    ? 'border-neon-magenta text-neon-magenta'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Info & Colors {tabErrors.info && <span className="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0 animate-pulse" />}
              </button>
              <button
                onClick={() => setActiveTab('cues')}
                className={`pb-2.5 px-4 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'cues'
                    ? 'border-neon-magenta text-neon-magenta'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Cues ({formCues.length}) {tabErrors.cues && <span className="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0 animate-pulse" />}
              </button>
              <button
                onClick={() => setActiveTab('socials')}
                className={`pb-2.5 px-4 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'socials'
                    ? 'border-neon-magenta text-neon-magenta'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Socials ({formSocials.length}) {tabErrors.socials && <span className="size-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] shrink-0 animate-pulse" />}
              </button>
              <button
                onClick={() => setActiveTab('console')}
                className={`pb-2.5 px-4 border-b-2 font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'console'
                    ? 'border-neon-magenta text-neon-magenta'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Console
              </button>
            </div>

            {/* Form body */}
            <div className="space-y-6 min-h-[300px]">
              {/* TAB 1: General Info & Palette */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Name field */}
                  <div className="space-y-2">
                    <Label htmlFor="rig-name" className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">Rig Name</Label>
                    <Input
                      id="rig-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Main Stadium Set"
                      className={`bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground font-cyber tracking-wide ${formErrors.name ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                    />
                    {formErrors.name && (
                      <p className="text-[10px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  {/* Display Name field */}
                  <div className="space-y-2">
                    <Label htmlFor="rig-display-name" className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">Display Name (Show Name)</Label>
                    <Input
                      id="rig-display-name"
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      placeholder="e.g. DJ Rig1 (Fallback to rig name on surface)"
                      className="bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground font-cyber tracking-wide"
                    />
                  </div>

                  {/* Default Art field */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">Default Visual Art</Label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {availableArts.map((artId) => (
                        <div
                          key={artId}
                          onClick={() => setFormDefaultArt(artId)}
                          className={`p-1.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 overflow-hidden relative group/art ${
                            formDefaultArt === artId
                              ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta shadow-[0_0_15px_-3px_rgba(255,0,200,0.15)]'
                              : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground hover:border-black/30 dark:hover:border-white/30 hover:text-foreground'
                          }`}
                        >
                          <div className="w-full aspect-video rounded-lg overflow-hidden border border-black/5 dark:border-white/5 bg-black/10 dark:bg-white/5 relative">
                            <img
                              src={`/previews/${artId}.png`}
                              alt={VISUAL_ART_LABELS[artId] || artId}
                              className="size-full object-cover transition-all duration-300 group-hover/art:scale-105"
                            />
                            {/* Hover overlay with Preview Button */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewArtId(artId as any);
                                }}
                                className="px-3 py-1.5 rounded-full bg-neon-magenta text-white text-[10px] font-cyber tracking-widest uppercase font-bold shadow-lg hover:scale-105 transition-all cursor-pointer"
                              >
                                Preview
                              </button>
                            </div>
                          </div>
                          <span className="text-[10px] font-cyber tracking-wider font-bold uppercase text-center pb-1">
                            {VISUAL_ART_LABELS[artId] || artId}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Color Palette Field */}
                  <ColorPaletteField
                    palette={formPalette}
                    onChange={setFormPalette}
                    maxColors={4}
                    label="Color Palette"
                    errors={formErrors}
                  />

                  {/* Logo Upload Field */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">Branding Logo (Upload)</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="logo-enabled"
                          checked={formLogoEnabled}
                          onChange={(e) => setFormLogoEnabled(e.target.checked)}
                          className="size-3.5 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-neon-magenta focus:ring-neon-magenta"
                        />
                        <Label htmlFor="logo-enabled" className="text-[10px] uppercase font-cyber tracking-widest text-foreground cursor-pointer">Enable Logo</Label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5">
                      <div className="flex items-center justify-center size-14 rounded-lg bg-black/[0.05] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 shrink-0 overflow-hidden relative">
                        {logoPreviewUrl ? (
                          <img
                            src={logoPreviewUrl}
                            alt="Logo preview"
                            className="size-full object-cover"
                          />
                        ) : editingRig?.logoAssetPath ? (
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/rig-logos/${editingRig.logoAssetPath}`}
                            alt="Branding Logo"
                            className="size-full object-cover"
                          />
                        ) : (
                          <FileImage className="size-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="relative">
                          <input
                            type="file"
                            id="logo-file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          <label
                            htmlFor="logo-file"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-xs font-cyber text-muted-foreground hover:border-black/30 dark:hover:border-white/30 hover:text-foreground transition-all cursor-pointer uppercase tracking-wider"
                          >
                            <Upload className="size-3.5" /> {logoFile ? 'Change File' : 'Select Image'}
                          </label>
                          {logoFile && (
                            <span className="ml-2 text-[10px] text-neon-magenta font-cyber uppercase tracking-wider">
                              {logoFile.name} ({(logoFile.size / 1024).toFixed(0)}KB)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-normal font-cyber tracking-wide">
                          MIME: PNG, JPEG, WEBP, SVG, GIF · MAX SIZE: 256KB
                        </p>
                      </div>
                    </div>

                    {formLogoEnabled && (
                      <div className="grid gap-4 sm:grid-cols-3 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-250">
                        <div className="space-y-1.5">
                          <Label htmlFor="logo-position" className="text-[10px] uppercase font-cyber tracking-wider text-muted-foreground">Position</Label>
                          <select
                            id="logo-position"
                            value={formLogoPosition}
                            onChange={(e) => setFormLogoPosition(e.target.value as any)}
                            className="w-full h-8 text-xs bg-black/30 border border-black/10 dark:border-white/10 rounded-lg text-foreground font-cyber px-2 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none"
                          >
                            <option value="center" className="bg-background text-foreground">Center</option>
                            <option value="top-left" className="bg-background text-foreground">Top Left</option>
                            <option value="top-right" className="bg-background text-foreground">Top Right</option>
                            <option value="bottom-left" className="bg-background text-foreground">Bottom Left</option>
                            <option value="bottom-right" className="bg-background text-foreground">Bottom Right</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="logo-effect" className="text-[10px] uppercase font-cyber tracking-wider text-muted-foreground">Effect / Animation</Label>
                          <select
                            id="logo-effect"
                            value={formLogoEffect}
                            onChange={(e) => setFormLogoEffect(e.target.value as any)}
                            className="w-full h-8 text-xs bg-black/30 border border-black/10 dark:border-white/10 rounded-lg text-foreground font-cyber px-2 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none"
                          >
                            <option value="none" className="bg-background text-foreground">None (Static)</option>
                            <option value="pulse" className="bg-background text-foreground">Pulsing Fade</option>
                            <option value="spin" className="bg-background text-foreground">Spinning</option>
                            <option value="float" className="bg-background text-foreground">Floating</option>
                            <option value="neon" className="bg-background text-foreground">Neon Glow</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="logo-opacity" className="text-[10px] uppercase font-cyber tracking-wider text-muted-foreground">Opacity ({formLogoOpacity})</Label>
                          <input
                            id="logo-opacity"
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={formLogoOpacity}
                            onChange={(e) => setFormLogoOpacity(Number(e.target.value))}
                            className="w-full h-8 accent-neon-magenta cursor-pointer font-cyber"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Code Overlay Settings moved to Info & Colors */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase font-cyber tracking-wider text-muted-foreground">Periodic QR Code Overlay</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="qr-overlay-enabled"
                          checked={formQrEnabled}
                          onChange={(e) => setFormQrEnabled(e.target.checked)}
                          className="size-3.5 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-neon-magenta focus:ring-neon-magenta cursor-pointer"
                        />
                        <Label htmlFor="qr-overlay-enabled" className="text-[10px] uppercase font-cyber tracking-widest text-foreground cursor-pointer select-none">Enable QR Overlay</Label>
                      </div>
                    </div>

                    {formQrEnabled && (
                      <div className="grid gap-4 sm:grid-cols-2 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-250">
                        {/* Checkbox for Always Show */}
                        <div className="col-span-2 flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            id="qr-always"
                            checked={formQrDuration === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormQrDuration(0);
                              } else {
                                setFormQrDuration(5); // default duration
                              }
                            }}
                            className="size-3.5 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-neon-magenta focus:ring-neon-magenta cursor-pointer"
                          />
                          <Label htmlFor="qr-always" className="text-[10px] uppercase font-cyber tracking-widest text-foreground cursor-pointer select-none">
                            Show permanently (Always)
                          </Label>
                        </div>

                        {formQrDuration > 0 && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="qr-interval" className="text-[10px] uppercase font-cyber tracking-wider text-muted-foreground">
                                Show QR code every (seconds)
                              </Label>
                              <Input
                                id="qr-interval"
                                type="number"
                                min={10}
                                max={3600}
                                value={formQrInterval}
                                onChange={(e) => setFormQrInterval(Number(e.target.value))}
                                className={`bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground font-cyber ${formErrors.qrInterval ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                              />
                              {formErrors.qrInterval && (
                                <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors.qrInterval}</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="qr-duration" className="text-[10px] uppercase font-cyber tracking-wider text-muted-foreground">
                                Show QR code for (seconds)
                              </Label>
                              <Input
                                id="qr-duration"
                                type="number"
                                min={2}
                                max={300}
                                value={formQrDuration}
                                onChange={(e) => setFormQrDuration(Number(e.target.value))}
                                className={`bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground font-cyber ${formErrors.qrDuration ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                              />
                              {formErrors.qrDuration && (
                                <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors.qrDuration}</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Default Status Checkbox */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="rig-default"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="size-4 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-neon-magenta focus:ring-neon-magenta"
                    />
                    <Label htmlFor="rig-default" className="text-xs uppercase font-cyber tracking-wider text-foreground cursor-pointer select-none">
                      Set as primary default Rig for new rooms
                    </Label>
                  </div>
                </div>
              )}

              {/* TAB 2: Cue List Editor */}
              {activeTab === 'cues' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs uppercase font-cyber tracking-widest text-muted-foreground">
                      Rig Visual Cues (GO/Next sequencing)
                    </p>
                    <button
                      type="button"
                      onClick={addCue}
                      className="flex items-center gap-1 text-[10px] font-cyber text-neon-magenta hover:text-foreground transition-all uppercase cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add cue
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {formCues.map((cue, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-3 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 relative group"
                      >
                        {/* Ordering controls */}
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveCue(idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            <ChevronUp className="size-3.5" />
                          </button>
                          <span className="text-center text-[10px] font-cyber text-foreground font-bold">
                            {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveCue(idx, 'down')}
                            disabled={idx === formCues.length - 1}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground hover:text-foreground transition cursor-pointer"
                          >
                            <ChevronDown className="size-3.5" />
                          </button>
                        </div>

                        {/* Cue Details Fields */}
                        <div className="flex-1 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                          {/* Label */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Label</label>
                            <Input
                              value={cue.label || ''}
                              onChange={(e) => updateCueField(idx, 'label', e.target.value)}
                              placeholder="e.g. Intro Strobe"
                              className={`h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground p-2 font-cyber ${formErrors[`cue_label_${idx}`] ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                            />
                            {formErrors[`cue_label_${idx}`] && (
                              <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors[`cue_label_${idx}`]}</p>
                            )}
                          </div>

                          {/* Visual Art Selector */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Visual Art</label>
                            <select
                              value={cue.visualArtId}
                              onChange={(e) => updateCueField(idx, 'visualArtId', e.target.value)}
                              className="w-full h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-lg text-foreground font-cyber px-2 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none"
                            >
                              {availableArts.map((artId) => (
                                <option key={artId} value={artId} className="bg-background text-foreground">
                                  {VISUAL_ART_LABELS[artId] || artId}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Transition Type */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Transition</label>
                            <select
                              value={cue.transition?.type || 'fade'}
                              onChange={(e) => updateCueField(idx, 'transition.type', e.target.value)}
                              className="w-full h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-lg text-foreground font-cyber px-2 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none"
                            >
                              <option value="cut" className="bg-background text-foreground">CUT (Instant)</option>
                              <option value="fade" className="bg-background text-foreground">FADE (Linear)</option>
                            </select>
                          </div>

                          {/* Transition Duration */}
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Duration (ms)</label>
                            <Input
                              type="number"
                              value={cue.transition?.durationMs ?? 1000}
                              disabled={cue.transition?.type === 'cut'}
                              onChange={(e) => updateCueField(idx, 'transition.durationMs', e.target.value)}
                              className={`h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground p-2 font-cyber ${formErrors[`cue_duration_${idx}`] ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                              min={100}
                              max={10000}
                              step={100}
                            />
                            {formErrors[`cue_duration_${idx}`] && (
                              <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors[`cue_duration_${idx}`]}</p>
                            )}
                          </div>
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => removeCue(idx)}
                          className="text-red-500/70 hover:text-red-500 p-1 cursor-pointer self-center"
                          title="Remove Cue"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}

                    {formCues.length === 0 && (
                      <div className="py-12 border border-dashed border-white/10 rounded-xl text-center">
                        <Layers className="size-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground uppercase font-cyber tracking-widest">
                          No cues defined. DJ will need to manually load preset arts.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Socials Links Editor */}
              {activeTab === 'socials' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs uppercase font-cyber tracking-widest text-muted-foreground">
                      Social Links (DJ Public page links)
                    </p>
                    <button
                      type="button"
                      onClick={addSocial}
                      className="flex items-center gap-1 text-[10px] font-cyber text-neon-magenta hover:text-foreground transition-all uppercase cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add link
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {formSocials.map((social, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-3 bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/5 dark:border-white/5 relative"
                      >
                        {/* Kind Selector */}
                        <div className="space-y-1 w-full sm:w-[150px]">
                          <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Platform</label>
                          <select
                            value={social.kind}
                            onChange={(e) => updateSocialField(idx, 'kind', e.target.value)}
                            className="w-full h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-lg text-foreground font-cyber px-2 focus:ring-1 focus:ring-neon-magenta focus:border-neon-magenta focus:outline-none"
                          >
                            {SOCIAL_KINDS.map((k) => (
                              <option key={k.value} value={k.value} className="bg-background text-foreground">
                                {k.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Label (Optional) */}
                        <div className="flex-1 min-w-[150px] space-y-1">
                          <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">Custom Label</label>
                          <Input
                            value={social.label || ''}
                            onChange={(e) => updateSocialField(idx, 'label', e.target.value)}
                            placeholder="e.g. My SoundCloud / Custom"
                            className={`h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground p-2 font-cyber ${formErrors[`social_label_${idx}`] ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                          />
                          {formErrors[`social_label_${idx}`] && (
                            <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors[`social_label_${idx}`]}</p>
                          )}
                        </div>

                        {/* URL */}
                        <div className="flex-[2] min-w-[200px] space-y-1">
                          <label className="text-[9px] uppercase font-cyber tracking-widest text-muted-foreground">URL Link</label>
                          <Input
                            value={social.url}
                            onChange={(e) => updateSocialField(idx, 'url', e.target.value)}
                            placeholder="https://..."
                            className={`h-8 text-xs bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground p-2 font-cyber ${formErrors[`social_url_${idx}`] ? 'border-red-500/50 focus-visible:ring-red-500' : ''}`}
                          />
                          {formErrors[`social_url_${idx}`] && (
                            <p className="text-[9px] text-red-500 font-cyber uppercase tracking-wider font-bold mt-1">{formErrors[`social_url_${idx}`]}</p>
                          )}
                        </div>

                        {/* Toggle Enabled */}
                        <div className="flex flex-col items-center gap-1 font-cyber">
                          <label className="text-[9px] uppercase tracking-widest text-muted-foreground">Enabled</label>
                          <input
                            type="checkbox"
                            checked={social.enabled}
                            onChange={(e) => updateSocialField(idx, 'enabled', e.target.checked)}
                            className="size-4 rounded border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 text-neon-magenta focus:ring-neon-magenta cursor-pointer"
                          />
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => removeSocial(idx)}
                          className="text-red-500/70 hover:text-red-500 p-1 cursor-pointer self-end mb-1"
                          title="Remove Link"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}

                    {formSocials.length === 0 && (
                      <div className="py-12 border border-dashed border-white/10 rounded-xl text-center">
                        <Globe className="size-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground uppercase font-cyber tracking-widest">
                          No links defined. Add pages to stay in touch with your audience!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: Console Settings */}
              {activeTab === 'console' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-cyber uppercase tracking-widest text-foreground font-bold mb-1">
                      Desk Layout Settings
                    </h4>
                    <p className="text-xs text-muted-foreground leading-normal font-sans mb-4">
                      Determine which control tabs the DJ console displays when loading this Rig.
                    </p>

                    <div className="space-y-3">
                      {/* Devices Tab Toggle */}
                      <div
                        onClick={() => toggleConsoleTab('devices')}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          formConsoleTabs.includes('devices')
                            ? 'border-neon-magenta bg-neon-magenta/5 text-foreground'
                            : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground hover:border-black/20 dark:hover:border-white/20'
                        }`}
                      >
                        <div>
                          <span className="font-cyber font-bold uppercase tracking-wider text-xs block">
                            Devices Control Tab
                          </span>
                          <span className="text-[10px] text-muted-foreground font-cyber tracking-wide uppercase mt-0.5 block">
                            Provides control over phone matrix strobe, grid, and fallback sync colors
                          </span>
                        </div>
                        <div className="flex items-center">
                          {formConsoleTabs.includes('devices') ? (
                            <Check className="size-5 text-neon-magenta" />
                          ) : (
                            <span className="text-[10px] font-cyber text-muted-foreground">HIDDEN</span>
                          )}
                        </div>
                      </div>

                      {/* Visuals Tab Toggle */}
                      <div
                        onClick={() => toggleConsoleTab('visuals')}
                        className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          formConsoleTabs.includes('visuals')
                            ? 'border-neon-magenta bg-neon-magenta/5 text-foreground'
                            : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground hover:border-black/20 dark:hover:border-white/20'
                        }`}
                      >
                        <div>
                          <span className="font-cyber font-bold uppercase tracking-wider text-xs block">
                            Visuals Projection Tab
                          </span>
                          <span className="text-[10px] text-muted-foreground font-cyber tracking-wide uppercase mt-0.5 block">
                            Controls the projection wall canvas, active visual art cue lists, and palettes
                          </span>
                        </div>
                        <div className="flex items-center">
                          {formConsoleTabs.includes('visuals') ? (
                            <Check className="size-5 text-neon-magenta" />
                          ) : (
                            <span className="text-[10px] font-cyber text-muted-foreground">HIDDEN</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>


                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-6">
              <NeonButton
                color="cyan"
                variant="outline"
                onClick={closeForm}
                disabled={uploadingLogo}
                className="h-10 text-xs uppercase tracking-widest px-6"
              >
                Cancel
              </NeonButton>
              <NeonButton
                color="magenta"
                variant="solid"
                onClick={handleSave}
                disabled={uploadingLogo || !isFormDirty || Object.keys(formErrors).length > 0}
                className="h-10 text-xs uppercase tracking-widest px-6"
              >
                {uploadingLogo ? 'Uploading logo...' : 'Save Configuration'}
              </NeonButton>
            </div>
          </NeonCard>
        )}
      </PageTransitionWrapper>

      {/* Preview Modal */}
      {previewArtId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl flex flex-col justify-end">
            
            {/* Canvas for Live Render */}
            <canvas
              ref={previewCanvasRef}
              className="absolute inset-0 size-full"
            />
            
            {/* Logo Overlay inside Preview */}
            {formLogoEnabled && (logoPreviewUrl || (editingRig && editingRig.logoAssetPath)) && (
              <div
                className={`absolute pointer-events-none z-10 transition-all duration-500 ${
                  formLogoPosition === 'center' ? 'inset-0 flex items-center justify-center' :
                  formLogoPosition === 'top-left' ? 'top-6 left-6 max-w-[12%] max-h-[12%]' :
                  formLogoPosition === 'top-right' ? 'top-6 right-6 max-w-[12%] max-h-[12%]' :
                  formLogoPosition === 'bottom-left' ? 'bottom-6 left-6 max-w-[12%] max-h-[12%]' :
                  'bottom-6 right-6 max-w-[12%] max-h-[12%]'
                }`}
                style={{ opacity: formLogoOpacity }}
              >
                <img
                  src={logoPreviewUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/rig-logos/${editingRig?.logoAssetPath}`}
                  alt="Branding Logo"
                  className={`object-contain ${
                    formLogoPosition === 'center' ? 'max-w-[30%] max-h-[30%]' : 'w-full h-full'
                  } ${
                    formLogoEffect === 'pulse' ? 'animate-[pulse_2s_ease-in-out_infinite]' :
                    formLogoEffect === 'spin' ? 'animate-[spin_8s_linear_infinite]' :
                    formLogoEffect === 'float' ? 'animate-[float_4s_ease-in-out_infinite]' :
                    formLogoEffect === 'neon' ? 'animate-[neon-glow_3s_ease-in-out_infinite]' :
                    ''
                  }`}
                />
              </div>
            )}

            {/* Periodic QR Overlay inside Preview */}
            {showPreviewQr && previewQrDataUrl && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in zoom-in duration-300 pointer-events-none">
                <div className="relative p-6 rounded-3xl border border-neon-magenta/30 bg-black/85 shadow-[0_0_40px_rgba(255,0,229,0.2)] flex flex-col items-center gap-3 max-w-[280px]">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border border-neon-cyan/40 bg-black px-4 py-1 shadow-[0_0_10px_rgba(0,229,255,0.15)]">
                    <span className="font-cyber font-black tracking-widest text-[9px] text-neon-cyan neon-text-cyan uppercase">
                      JOIN THE RAVE
                    </span>
                  </div>
                  <img
                    src={previewQrDataUrl}
                    alt="Join QR Code"
                    className="w-44 h-44 rounded-xl border-2 border-white shadow-xl"
                  />
                  <div className="text-center mt-1">
                    <h4 className="font-display font-black tracking-widest text-sm text-white leading-none">
                      ROOM: PREVIEW
                    </h4>
                  </div>
                </div>
              </div>
            )}

            <style>{`
              @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
              }
              @keyframes neon-glow {
                0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 0, 200, 0.3)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.15)); }
                50% { filter: drop-shadow(0 0 15px rgba(255, 0, 200, 0.75)) drop-shadow(0 0 30px rgba(0, 229, 255, 0.4)); }
              }
            `}</style>
            
            {/* Control / Info Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 flex items-end justify-between pointer-events-none z-10">
              <div className="space-y-1">
                <h3 className="text-white font-display uppercase tracking-widest text-lg font-black text-neon-cyan neon-text-cyan">
                  Live Preview: {VISUAL_ART_LABELS[previewArtId] || previewArtId}
                </h3>
                <p className="text-[10px] font-cyber tracking-wider text-muted-foreground uppercase">
                  Simulating real-time audio reactivity & palette sync
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewArtId(null)}
                className="pointer-events-auto h-9 px-5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black font-cyber text-xs uppercase tracking-widest font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Close corner button */}
            <button
              type="button"
              onClick={() => setPreviewArtId(null)}
              className="absolute top-4 right-4 z-20 size-10 rounded-full bg-black/60 hover:bg-black border border-white/10 hover:border-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Close Preview"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
