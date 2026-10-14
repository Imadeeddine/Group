import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  runTransaction 
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  UserPlus, 
  Trash2, 
  Check, 
  Copy, 
  User, 
  Home, 
  Bell, 
  Share2,
  Sparkles,
  X,
  Edit2,
  MessageCircle,
  UserCheck,
  Layers,
  ChevronRight,
  ChevronLeft,
  Lock,
  ShieldAlert,
  KeyRound,
  BookOpen,
  GraduationCap,
  Send,
  FileText,
  Printer,
  Download,
  Cloud,
  CloudCheck,
  Loader2
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Group {
  id: string;
  name: string;
  createdAt: number;
  members: string[];
}

interface Subject {
  id: string;
  name: string;
  professorName?: string;
  createdAt: number;
  groups: Group[];
}

interface ActivityLog {
  id: string;
  text: string;
  time: string;
}

interface PendingDelete {
  type: 'subject' | 'group' | 'member';
  subjectId: string;
  subjectName?: string;
  groupId?: string;
  groupName?: string;
  memberIndex?: number;
  memberName?: string;
}

export default function App() {
  // Subjects state
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('app_subjects_data');
      if (saved) return JSON.parse(saved);
      
      // Migration from old app_groups_data if available
      const oldGroups = localStorage.getItem('app_groups_data');
      if (oldGroups) {
        const parsedOld = JSON.parse(oldGroups);
        if (Array.isArray(parsedOld) && parsedOld.length > 0) {
          return [
            {
              id: 'sub_1',
              name: 'المادة الأولى',
              professorName: 'الأستاذ المشرف',
              createdAt: Date.now(),
              groups: parsedOld
            }
          ];
        }
      }
    } catch {
      // fallback
    }
    return [
      {
        id: '1',
        name: 'برمجة وتطوير الويب',
        professorName: 'أ.د. عماد',
        createdAt: Date.now(),
        groups: [
          {
            id: 'g_1',
            name: 'المجموعة 1',
            createdAt: Date.now(),
            members: ['محمد علي', 'سارة أحمد']
          }
        ]
      }
    ];
  });

  // Selected subject ID (null means currently browsing subjects list)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // New subject inputs
  const [newSubjectName, setNewSubjectName] = useState<string>('');
  const [newProfessorName, setNewProfessorName] = useState<string>('');
  const [showAddSubjectForm, setShowAddSubjectForm] = useState<boolean>(false);

  // PDF Preview and Download Modal
  const [pdfSubject, setPdfSubject] = useState<Subject | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Logs
  const [activities, setActivities] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('app_groups_logs');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [
      {
        id: '1',
        text: 'تم تشغيل تطبيق تسجيل المجموعات والمواد',
        time: 'الآن'
      }
    ];
  });

  // Current inputs for each group: { [groupId]: string }
  const [memberInputs, setMemberInputs] = useState<Record<string, string>>({});
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'home' | 'groups' | 'notifications' | 'profile'>('home');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Security passcode modal state for trash can ('imad')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deletePasscode, setDeletePasscode] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);
  const [hasPendingWrites, setHasPendingWrites] = useState<boolean>(false);
  
  // Optimistic UI state: immediate rendering of registering students before network roundtrip
  const [savingGroup, setSavingGroup] = useState<Record<string, boolean>>({});
  const [pendingMembers, setPendingMembers] = useState<Record<string, string[]>>({});

  // Real-time Firestore synchronization across all devices with metadata tracking
  useEffect(() => {
    try {
      const subjectsCol = collection(db, 'subjects');
      const unsubscribe = onSnapshot(subjectsCol, { includeMetadataChanges: true }, (snapshot) => {
        const cloudSubjects: Subject[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudSubjects.push({
            id: docSnap.id,
            name: data.name || '',
            professorName: data.professorName || 'أستاذ المادة',
            createdAt: data.createdAt || Date.now(),
            groups: Array.isArray(data.groups) ? data.groups : []
          });
        });

        cloudSubjects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Preserve and display whatever is in Firestore without wiping
        if (cloudSubjects.length > 0) {
          setSubjects(cloudSubjects);
        }
        setIsCloudSynced(true);
        setHasPendingWrites(snapshot.metadata.hasPendingWrites);

        // Auto-cleanup any pending members that now exist in the confirmed cloud data
        setPendingMembers(prev => {
          let hasChanges = false;
          const next = { ...prev };
          cloudSubjects.forEach(s => {
            s.groups.forEach(g => {
              if (next[g.id] && next[g.id].length > 0) {
                const filtered = next[g.id].filter(name => !g.members.includes(name));
                if (filtered.length !== next[g.id].length) {
                  hasChanges = true;
                  if (filtered.length === 0) {
                    delete next[g.id];
                  } else {
                    next[g.id] = filtered;
                  }
                }
              }
            });
          });
          return hasChanges ? next : prev;
        });
      }, (error) => {
        console.error('Firestore snapshot sync error:', error);
        setIsCloudSynced(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error('Firestore initialization error:', e);
      setIsCloudSynced(false);
    }
  }, []);

  // Save to local storage as offline cache only
  useEffect(() => {
    try {
      localStorage.setItem('app_subjects_data', JSON.stringify(subjects));
      localStorage.setItem('app_groups_logs', JSON.stringify(activities));
    } catch (e) {
      console.error(e);
    }
  }, [subjects, activities]);

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => {
      setNotificationMsg(null);
    }, 2500);
  };

  const addLog = (text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setActivities(prev => [{ id: Date.now().toString(), text, time: timeStr }, ...prev.slice(0, 19)]);
  };

  // Add a new subject atomically
  const handleAddSubject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;

    const newSubject: Subject = {
      id: 'sub_' + Date.now().toString(),
      name,
      professorName: newProfessorName.trim() || 'أستاذ المادة',
      createdAt: Date.now(),
      groups: []
    };

    setNewSubjectName('');
    setNewProfessorName('');
    setShowAddSubjectForm(false);

    try {
      await setDoc(doc(db, 'subjects', newSubject.id), newSubject);
      addLog(`تمت إضافة مادة جديدة: "${name}" (${newSubject.professorName})`);
      showToast(`تمت إضافة مادة "${name}" بنجاح! 📚`);
      setSelectedSubjectId(newSubject.id);
      setActiveTab('groups');
    } catch (err) {
      console.error('Error creating subject in Firestore:', err);
      showToast('حدث خطأ أثناء حفظ المادة في السحابة');
    }
  };

  // Add a new group inside current subject using Firestore Transaction (Concurrency Safe)
  const handleAddGroup = async () => {
    if (!selectedSubjectId) return;

    try {
      const subjectDocRef = doc(db, 'subjects', selectedSubjectId);
      let newGroupName = '';

      await runTransaction(db, async (transaction) => {
        const subDoc = await transaction.get(subjectDocRef);
        if (!subDoc.exists()) {
          throw new Error('المادة غير موجودة في قاعدة البيانات');
        }

        const data = subDoc.data();
        const cloudGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];
        const newGroupNum = cloudGroups.length + 1;
        newGroupName = `المجموعة ${newGroupNum}`;

        const newGroup: Group = {
          id: 'grp_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6),
          name: newGroupName,
          createdAt: Date.now(),
          members: []
        };

        const updatedGroups = [newGroup, ...cloudGroups];
        transaction.update(subjectDocRef, { groups: updatedGroups });
      });

      addLog(`تمت إضافة ${newGroupName}`);
      showToast(`تمت إضافة ${newGroupName} بنجاح!`);
    } catch (err) {
      console.error('Error adding group in transaction:', err);
      showToast('حدث خطأ أثناء إضافة المجموعة، يرجى إعادة المحاولة');
    }
  };

  // Add student / member to group with Optimistic UI + Concurrency Safe Firestore Transaction
  const handleAddMember = async (groupId: string) => {
    if (!selectedSubjectId) return;
    const cleanName = memberInputs[groupId]?.trim();
    if (!cleanName) return;

    // Prevent double clicking / concurrent submission on same group
    if (savingGroup[groupId]) return;

    // Check if student already in the group locally
    const targetGroup = currentSubject?.groups.find(g => g.id === groupId);
    const existingMembers = targetGroup?.members || [];
    const existingPending = pendingMembers[groupId] || [];
    if (existingMembers.includes(cleanName) || existingPending.includes(cleanName)) {
      showToast(`الطالب "${cleanName}" مسجل بالفعل في هذه المجموعة!`);
      return;
    }

    // 1. Optimistic UI update:
    // Add student immediately to local pending state so they appear instantly on screen
    setPendingMembers(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), cleanName]
    }));
    // Clear input field immediately
    setMemberInputs(prev => ({ ...prev, [groupId]: '' }));
    // Set saving state to disable submit button and show spinner
    setSavingGroup(prev => ({ ...prev, [groupId]: true }));

    try {
      const subjectDocRef = doc(db, 'subjects', selectedSubjectId);
      let targetGroupName = '';
      let isAlreadyRegistered = false;

      // Atomic transaction: reads latest cloud state, appends student, commits back
      await runTransaction(db, async (transaction) => {
        const subDoc = await transaction.get(subjectDocRef);
        if (!subDoc.exists()) {
          throw new Error('المادة غير موجودة في السحابة');
        }

        const data = subDoc.data();
        const cloudGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];

        const updatedGroups = cloudGroups.map(group => {
          if (group.id === groupId) {
            targetGroupName = group.name;
            const currentMembers = Array.isArray(group.members) ? group.members : [];
            // Prevent duplicate registration if name already exists in cloud
            if (currentMembers.includes(cleanName)) {
              isAlreadyRegistered = true;
              return group;
            }
            return {
              ...group,
              members: [...currentMembers, cleanName]
            };
          }
          return group;
        });

        transaction.update(subjectDocRef, { groups: updatedGroups });
      });

      // Clear from pending since it's now officially written into cloud
      setPendingMembers(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(name => name !== cleanName)
      }));

      if (isAlreadyRegistered) {
        showToast(`الطالب "${cleanName}" مسجل بالفعل في هذه المجموعة!`);
      } else {
        addLog(`انضم الطالب "${cleanName}" إلى ${targetGroupName}`);
        showToast(`تم تسجيل الطالب "${cleanName}" بنجاح وتأمينه سحابياً! ✅`);
      }
    } catch (err) {
      console.error('Transaction failed for addMember:', err);
      // Rollback optimistic state
      setPendingMembers(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).filter(name => name !== cleanName)
      }));
      // Restore input text so the student does not have to retype
      setMemberInputs(prev => ({ ...prev, [groupId]: cleanName }));
      showToast('تعذر الحفظ في السحابة، أعد المحاولة');
    } finally {
      setSavingGroup(prev => ({ ...prev, [groupId]: false }));
    }
  };

  // Rename group using Firestore Transaction (Concurrency Safe)
  const handleSaveRename = async (groupId: string) => {
    if (!selectedSubjectId || !editingGroupName.trim()) {
      setEditingGroupId(null);
      return;
    }

    const newName = editingGroupName.trim();
    try {
      const subjectDocRef = doc(db, 'subjects', selectedSubjectId);

      await runTransaction(db, async (transaction) => {
        const subDoc = await transaction.get(subjectDocRef);
        if (!subDoc.exists()) return;

        const data = subDoc.data();
        const cloudGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];

        // Update ONLY the group name, leaving all members untouched
        const updatedGroups = cloudGroups.map(g => {
          if (g.id === groupId) return { ...g, name: newName };
          return g;
        });

        transaction.update(subjectDocRef, { groups: updatedGroups });
      });

      setEditingGroupId(null);
      showToast('تم تعديل اسم المجموعة سحابياً');
    } catch (err) {
      console.error('Error renaming group in transaction:', err);
      showToast('حدث خطأ أثناء تعديل الاسم');
    }
  };

  // Request deletion handlers (all require passcode 'imad')
  const requestDeleteSubject = (subjectId: string, subjectName: string) => {
    setPendingDelete({
      type: 'subject',
      subjectId,
      subjectName
    });
    setDeletePasscode('');
    setPasscodeError(null);
  };

  const requestDeleteGroup = (subjectId: string, groupId: string, groupName: string) => {
    setPendingDelete({
      type: 'group',
      subjectId,
      groupId,
      groupName
    });
    setDeletePasscode('');
    setPasscodeError(null);
  };

  const requestDeleteMember = (subjectId: string, groupId: string, groupName: string, memberIndex: number, memberName: string) => {
    setPendingDelete({
      type: 'member',
      subjectId,
      groupId,
      groupName,
      memberIndex,
      memberName
    });
    setDeletePasscode('');
    setPasscodeError(null);
  };

  // Confirm delete with passcode 'imad' using atomic transactions
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDelete) return;

    if (deletePasscode.trim().toLowerCase() !== 'imad') {
      setPasscodeError('الرمز غير صحيح! لم يتم الحذف');
      return;
    }

    // Code is 'imad' -> perform requested delete
    if (pendingDelete.type === 'subject') {
      try {
        await deleteDoc(doc(db, 'subjects', pendingDelete.subjectId));
        if (selectedSubjectId === pendingDelete.subjectId) {
          setSelectedSubjectId(null);
          setActiveTab('home');
        }
        addLog(`تم حذف المادة "${pendingDelete.subjectName}"`);
        showToast(`تم حذف المادة "${pendingDelete.subjectName}" بنجاح 🗑️`);
      } catch (err) {
        console.error('Error deleting subject:', err);
      }
    } else if (pendingDelete.type === 'group' && pendingDelete.groupId) {
      const targetGroupId = pendingDelete.groupId;
      try {
        const subjectDocRef = doc(db, 'subjects', pendingDelete.subjectId);
        await runTransaction(db, async (transaction) => {
          const subDoc = await transaction.get(subjectDocRef);
          if (!subDoc.exists()) return;

          const data = subDoc.data();
          const cloudGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];
          const updatedGroups = cloudGroups.filter(g => g.id !== targetGroupId);

          transaction.update(subjectDocRef, { groups: updatedGroups });
        });
        addLog(`تم حذف ${pendingDelete.groupName}`);
        showToast(`تم حذف ${pendingDelete.groupName} بنجاح 🗑️`);
      } catch (err) {
        console.error('Error deleting group in transaction:', err);
      }
    } else if (pendingDelete.type === 'member' && pendingDelete.groupId && pendingDelete.memberName) {
      const targetMember = pendingDelete.memberName;
      const targetGroupId = pendingDelete.groupId;

      try {
        const subjectDocRef = doc(db, 'subjects', pendingDelete.subjectId);
        await runTransaction(db, async (transaction) => {
          const subDoc = await transaction.get(subjectDocRef);
          if (!subDoc.exists()) return;

          const data = subDoc.data();
          const cloudGroups: Group[] = Array.isArray(data.groups) ? data.groups : [];

          const updatedGroups = cloudGroups.map(g => {
            if (g.id === targetGroupId) {
              const currentMembers = Array.isArray(g.members) ? g.members : [];
              return {
                ...g,
                members: currentMembers.filter(m => m !== targetMember)
              };
            }
            return g;
          });

          transaction.update(subjectDocRef, { groups: updatedGroups });
        });
        addLog(`تم حذف الطالب "${targetMember}" من ${pendingDelete.groupName}`);
        showToast(`تم حذف الطالب "${targetMember}" بنجاح 🗑️`);
      } catch (err) {
        console.error('Error deleting member in transaction:', err);
      }
    }

    setPendingDelete(null);
    setDeletePasscode('');
    setPasscodeError(null);
  };

  // Copy group members
  const handleCopyGroup = (subjectName: string, group: Group) => {
    if (group.members.length === 0) {
      showToast('المجموعة فارغة، لا يوجد أسماء لنسخها');
      return;
    }
    const text = `📋 مادة: ${subjectName}\n🔹 ${group.name}:\n` + group.members.map((m, i) => `${i + 1}. ${m}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedGroupId(group.id);
    showToast(`تم نسخ قائمة أعضاء ${group.name}!`);
    setTimeout(() => setCopiedGroupId(null), 2000);
  };

  // Share to WhatsApp
  const handleShareWhatsApp = (subjectName: string, group: Group) => {
    if (group.members.length === 0) {
      showToast('المجموعة فارغة، لا يوجد أسماء لمشاركتها');
      return;
    }
    const text = encodeURIComponent(`📋 *مادة: ${subjectName}*\n🔹 *${group.name}* (${group.members.length} طلاب):\n` + group.members.map((m, i) => `${i + 1}. ${m}`).join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Download real PDF file using html2pdf.js (instead of raw HTML code)
  const handleDownloadPdf = async (subject: Subject) => {
    const element = document.getElementById('printable-groups-pdf-content');
    if (!element) {
      window.print();
      return;
    }

    setIsGeneratingPdf(true);
    showToast('جاري إنشاء وتحميل ملف الـ PDF... ⏳');

    try {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `كشف_مجموعات_${subject.name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
      showToast('تم تحميل كشف المجموعات كـ PDF بنجاح! 📄');
    } catch (err) {
      console.error('PDF export error, falling back to print:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // Copy subject groups and members as clean text to clipboard
  const handleCopySubjectGroups = (subject: Subject) => {
    let text = `📋 كشف مجموعات مادة: ${subject.name}\n👨‍🏫 الأستاذ: ${subject.professorName || 'أستاذ المادة'}\n\n`;
    if (subject.groups.length === 0) {
      text += 'لا توجد مجموعات مسجلة بعد.';
    } else {
      subject.groups.forEach((g) => {
        text += `🔹 ${g.name} (${g.members.length} طلاب):\n`;
        if (g.members.length === 0) {
          text += '  (لا يوجد طلبة مسجلين بعد)\n';
        } else {
          g.members.forEach((m, idx) => {
            text += `  ${idx + 1}. ${m}\n`;
          });
        }
        text += '\n';
      });
    }
    navigator.clipboard.writeText(text);
    showToast('تم نسخ قائمة المجموعات والأسماء بنجاح! 📋');
  };

  // Share subject groups and members directly to WhatsApp
  const handleShareSubjectWhatsApp = (subject: Subject) => {
    let text = `📋 *كشف مجموعات مادة: ${subject.name}*\n👨‍🏫 *الأستاذ:* ${subject.professorName || 'أستاذ المادة'}\n\n`;
    if (subject.groups.length === 0) {
      text += 'لا توجد مجموعات مسجلة بعد.';
    } else {
      subject.groups.forEach((g) => {
        text += `🔹 *${g.name}* (${g.members.length} طلاب):\n`;
        if (g.members.length === 0) {
          text += '  (فارغة)\n';
        } else {
          g.members.forEach((m, idx) => {
            text += `  ${idx + 1}. ${m}\n`;
          });
        }
        text += '\n';
      });
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Current active subject object
  const currentSubject = subjects.find(s => s.id === selectedSubjectId);

  // Overall Statistics including optimistic pending registrations
  const pendingStudentsCount = Object.values(pendingMembers).reduce((acc, list) => acc + list.length, 0);
  const totalGroups = subjects.reduce((acc, s) => acc + s.groups.length, 0);
  const totalStudents = subjects.reduce((acc, s) => acc + s.groups.reduce((gAcc, g) => gAcc + g.members.length, 0), 0) + pendingStudentsCount;

  // Teacher message helper
  const teacherMessage = "السلام عليكم أستاذ، هذا تطبيق تسجيل مجموعات المشاريع. أضف المادة أولاً واكتب اسمها، ثم اضغط عليها للدخول، وبعدها أنشئ المجموعات وسجّل أسماء الطلبة داخل كل مجموعة.";

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-slate-100 flex flex-col items-center justify-start overflow-hidden">
      {/* Container simulating mobile frame */}
      <div className="w-full max-w-md bg-white h-full sm:h-[94vh] sm:my-auto sm:rounded-3xl shadow-xl flex flex-col overflow-hidden border border-slate-200/80 relative">
        
        {/* Toast Notification */}
        {notificationMsg && (
          <div className="no-print absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-full shadow-lg backdrop-blur flex items-center gap-2 animate-fade-in transition-all">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-medium">{notificationMsg}</span>
          </div>
        )}

        {/* Top Header - Sticky so it stays visible during scroll */}
        <header className="no-print sticky top-0 z-30 bg-[#5925dc] text-white px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-lg tracking-tight">تسجيل مجموعات المشاريع</h1>
                {hasPendingWrites ? (
                  <span className="flex items-center gap-1 bg-amber-500/30 border border-amber-300/60 text-amber-100 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-200" />
                    <span>جارٍ الحفظ...</span>
                  </span>
                ) : isCloudSynced ? (
                  <span className="flex items-center gap-1 bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>سحابي مباشر</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    <span>غير متصل</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-purple-200">
                {currentSubject ? `المادة: ${currentSubject.name}` : `${subjects.length} مواد • ${totalStudents} طالب مسجل`}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 cursor-pointer transition"
            title="الملف الشخصي"
          >
            <User className="w-5 h-5 text-white" />
          </button>
        </header>

        {/* Instructions Banner for Teacher (can be copied with 1 click) */}
        <div className="no-print bg-purple-50/90 border-b border-purple-100 px-4 py-2 flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-1.5 truncate">
            <Send className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="truncate font-medium">رسالة شرح التطبيق للأستاذ جاهزة</span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(teacherMessage);
              showToast('تم نسخ رسالة الشرح للأستاذ بنجاح! 📋');
            }}
            className="text-[11px] font-bold text-[#5925dc] hover:underline shrink-0 bg-white px-2 py-0.5 rounded-md shadow-xs border border-purple-200 cursor-pointer"
          >
            نسخ الرسالة
          </button>
        </div>

        {/* Sub-header / Navigation context */}
        {activeTab === 'groups' && currentSubject && (
          <div className="no-print bg-purple-100/60 border-b border-purple-200 px-4 py-2.5 flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedSubjectId(null);
                setActiveTab('home');
              }}
              className="text-xs font-bold text-[#5925dc] hover:text-[#4118ab] flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>العودة لقائمة المواد</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPdfSubject(currentSubject)}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="تحميل كشف المجموعات PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>تحميل PDF</span>
              </button>
              <span className="text-xs font-extrabold text-slate-800 bg-white px-2.5 py-0.5 rounded-full border border-purple-200">
                📖 {currentSubject.name}
              </span>
            </div>
          </div>
        )}

        {/* Action Header Button:
            - If browsing subjects: "+ إضافة مادة"
            - If inside a subject: "+ إضافة مجموعة جديدة"
        */}
        {(activeTab === 'home' || (!selectedSubjectId && activeTab === 'groups')) && (
          <div className="no-print p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            {!showAddSubjectForm ? (
              <button
                onClick={() => setShowAddSubjectForm(true)}
                className="w-full bg-[#5925dc] hover:bg-[#491cbd] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>إضافة مادة</span>
              </button>
            ) : (
              <form onSubmit={handleAddSubject} className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-purple-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المادة:</label>
                  <input
                    type="text"
                    autoFocus
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="مثلاً: برمجة الويب، قواعد البيانات..."
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#5925dc] focus:ring-2 focus:ring-purple-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الأستاذ المسؤول:</label>
                  <input
                    type="text"
                    value={newProfessorName}
                    onChange={(e) => setNewProfessorName(e.target.value)}
                    placeholder="مثلاً: أ.د. عماد (اختياري)..."
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-[#5925dc] focus:ring-2 focus:ring-purple-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 outline-none transition"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubjectForm(false);
                      setNewSubjectName('');
                      setNewProfessorName('');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={!newSubjectName.trim()}
                    className="bg-[#5925dc] disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-[#491cbd] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>حفظ المادة والدخول</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* If inside groups page and a subject is selected: "+ إضافة مجموعة جديدة" */}
        {activeTab === 'groups' && currentSubject && (
          <div className="no-print p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <button
              onClick={handleAddGroup}
              className="w-full bg-[#5925dc] hover:bg-[#491cbd] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>إضافة مجموعة جديدة</span>
            </button>
          </div>
        )}

        {/* Main Content Area with bottom padding for fixed navbar */}
        <main className="no-print flex-1 overflow-y-auto p-4 space-y-4 pb-28">

          {/* VIEW 1: SUBJECTS LIST (Homepage or Groups without selected subject) */}
          {(activeTab === 'home' || (!selectedSubjectId && activeTab === 'groups')) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span>قائمة المواد والأساتذة</span>
                </h2>
                <span className="text-xs text-slate-400">
                  {subjects.length} مواد مسجلة
                </span>
              </div>

              {subjects.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                    <BookOpen className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-base font-bold text-slate-700 mb-1">لا توجد أي مادة حتى الآن</p>
                  <p className="text-xs text-slate-400 max-w-xs mb-4">
                    اضغط على زر «إضافة مادة» في الأعلى لكتابة اسم المادة والأستاذ وإنشاء مجموعاتها
                  </p>
                  <button
                    onClick={() => setShowAddSubjectForm(true)}
                    className="bg-[#5925dc] text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer"
                  >
                    + إضافة مادة الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {subjects.map((subject) => {
                    const studentCount = subject.groups.reduce((acc, g) => acc + g.members.length, 0);
                    return (
                      <div
                        key={subject.id}
                        className="bg-white rounded-2xl border border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-md transition-all overflow-hidden"
                      >
                        <div className="p-4 flex items-center justify-between">
                          <div 
                            onClick={() => {
                              setSelectedSubjectId(subject.id);
                              setActiveTab('groups');
                            }}
                            className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                          >
                            <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 text-[#5925dc] flex items-center justify-center shrink-0">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base hover:text-[#5925dc] transition truncate">
                                {subject.name}
                              </h3>
                              <p className="text-[11px] text-purple-700 font-medium">
                                👨‍🏫 الأستاذ: {subject.professorName || 'أستاذ المادة'}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {subject.groups.length} مجموعات • {studentCount} طالب مسجل
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Download PDF button */}
                            <button
                              onClick={() => setPdfSubject(subject)}
                              title="تحميل كشف المجموعات كـ PDF"
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-4 h-4 text-emerald-600" />
                              <span className="text-[11px] font-bold">PDF</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedSubjectId(subject.id);
                                setActiveTab('groups');
                              }}
                              className="bg-purple-50 hover:bg-purple-100 text-[#5925dc] text-xs font-bold px-2.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                            >
                              <span>فتح</span>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => requestDeleteSubject(subject.id, subject.name)}
                              title="حذف المادة (يتطلب الرمز)"
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          </div>
                        </div>

                        {/* Subject preview ribbon */}
                        {subject.groups.length > 0 && (
                          <div 
                            onClick={() => {
                              setSelectedSubjectId(subject.id);
                              setActiveTab('groups');
                            }}
                            className="bg-slate-50/70 border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto text-[11px] text-slate-500 cursor-pointer"
                          >
                            <span className="font-bold text-slate-400 shrink-0">المجموعات:</span>
                            {subject.groups.map(g => (
                              <span key={g.id} className="bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                                {g.name} ({g.members.length})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: GROUPS INSIDE SELECTED SUBJECT */}
          {activeTab === 'groups' && currentSubject && (
            <div className="space-y-4">
              {currentSubject.groups.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                    <Users className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-base font-bold text-slate-700 mb-1">
                    لا توجد مجموعات في مادة {currentSubject.name}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs mb-4">
                    اضغط على زر «إضافة مجموعة جديدة» في الأعلى للبدء في تقسيم الطلبة وتسجيل الأسماء
                  </p>
                  <button
                    onClick={handleAddGroup}
                    className="bg-[#5925dc] text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer"
                  >
                    + إضافة أول مجموعة الآن
                  </button>
                </div>
              ) : (
                currentSubject.groups.map((group) => {
                  const currentInput = memberInputs[group.id] || '';
                  const isEditing = editingGroupId === group.id;
                  const isSaving = !!savingGroup[group.id];
                  const currentGroupPending = pendingMembers[group.id] || [];
                  const activePending = currentGroupPending.filter(name => !group.members.includes(name));
                  const combinedMembers = [
                    ...group.members.map((name, i) => ({ 
                      id: `member_${group.id}_${name}_${i}`, 
                      name, 
                      isPending: false, 
                      realIndex: i 
                    })),
                    ...activePending.map((name) => ({ 
                      id: `pending_${group.id}_${name}`, 
                      name, 
                      isPending: true, 
                      realIndex: -1 
                    }))
                  ];
                  const displayTotalCount = combinedMembers.length;

                  return (
                    <div 
                      key={group.id} 
                      className="bg-white rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      {/* Group Header */}
                      <div className="bg-purple-50/70 px-4 py-3 border-b border-purple-100/60 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-[#5925dc] text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                            {displayTotalCount}
                          </div>
                          
                          {isEditing ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input 
                                type="text"
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                className="bg-white border border-purple-300 rounded px-2 py-0.5 text-sm font-bold text-slate-800 outline-none w-32"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(group.id);
                                }}
                              />
                              <button 
                                onClick={() => handleSaveRename(group.id)}
                                className="text-xs bg-[#5925dc] text-white px-2 py-0.5 rounded cursor-pointer"
                              >
                                حفظ
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span 
                                onClick={() => {
                                  setEditingGroupId(group.id);
                                  setEditingGroupName(group.name);
                                }}
                                className="font-bold text-slate-800 text-sm sm:text-base truncate cursor-pointer hover:text-purple-700 transition"
                                title="اضغط للتعديل"
                              >
                                {group.name}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingGroupId(group.id);
                                  setEditingGroupName(group.name);
                                }}
                                className="text-slate-400 hover:text-purple-600 p-0.5 cursor-pointer"
                                title="تعديل الاسم"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <span className="text-[11px] text-purple-700 font-medium bg-purple-100/80 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                            <span>{displayTotalCount} {displayTotalCount === 1 ? 'طالب' : 'طلاب'}</span>
                            {activePending.length > 0 && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            )}
                          </span>
                        </div>

                        {/* Actions for this group */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {group.members.length > 0 && (
                            <>
                              <button
                                onClick={() => handleShareWhatsApp(currentSubject.name, group)}
                                title="مشاركة عبر واتساب"
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              >
                                <MessageCircle className="w-4 h-4 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => handleCopyGroup(currentSubject.name, group)}
                                title="نسخ الأسماء"
                                className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-white rounded-lg transition cursor-pointer"
                              >
                                {copiedGroupId === group.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => requestDeleteGroup(currentSubject.id, group.id, group.name)}
                            title="حذف هذه المجموعة (يتطلب الرمز)"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Input field to write student name inside the group box */}
                      <div className="p-3.5 bg-slate-50/50 border-b border-slate-100">
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddMember(group.id);
                          }}
                          className="flex gap-2"
                        >
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={currentInput}
                              disabled={isSaving}
                              onChange={(e) => setMemberInputs(prev => ({ ...prev, [group.id]: e.target.value }))}
                              placeholder={isSaving ? "جارٍ تسجيل وحفظ الاسم سحابياً..." : "اكتب اسم الطالب داخل المجموعة..."}
                              className="w-full bg-white disabled:bg-slate-100/80 border border-slate-300 focus:border-[#5925dc] focus:ring-2 focus:ring-purple-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={!currentInput.trim() || isSaving}
                            className="bg-[#5925dc] disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-[#491cbd] text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition shadow-sm cursor-pointer"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>تسجيل...</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                <span>تسجيل</span>
                              </>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Members / Students List */}
                      <div className="p-3">
                        {combinedMembers.length === 0 ? (
                          <div className="py-3 text-center text-xs text-slate-400 italic">
                            لم يتم تسجيل أي طالب بعد، اكتب اسم الطالب واضغط تسجيل!
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {combinedMembers.map((item, idx) => (
                              <div 
                                key={item.id}
                                className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm border transition group ${
                                  item.isPending 
                                    ? 'bg-amber-50/90 border-amber-200/80 text-amber-950 shadow-xs' 
                                    : 'bg-slate-50 hover:bg-purple-50/50 border-slate-100 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                    item.isPending 
                                      ? 'bg-amber-200 text-amber-800' 
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <span className="font-semibold truncate">
                                    {item.name}
                                  </span>
                                  {item.isPending && (
                                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 animate-pulse">
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      <span>جارٍ الحفظ...</span>
                                    </span>
                                  )}
                                </div>

                                {!item.isPending && (
                                  <button
                                    onClick={() => requestDeleteMember(currentSubject.id, group.id, group.name, item.realIndex, item.name)}
                                    title="حذف الطالب من المجموعة (يتطلب الرمز)"
                                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW 3: NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-sm text-slate-800">سجل الإشعارات والأحداث</h2>
                <button
                  onClick={() => {
                    setActivities([]);
                    showToast('تم مسح سجل الإشعارات');
                  }}
                  className="text-xs text-rose-500 hover:underline cursor-pointer"
                >
                  مسح السجل
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  لا توجد إشعارات حالياً
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((act) => (
                    <div 
                      key={act.id} 
                      className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span className="text-slate-700 font-medium">{act.text}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{act.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: PROFILE / SETTINGS TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm text-center">
                <div className="w-16 h-16 rounded-full bg-purple-100 text-[#5925dc] flex items-center justify-center mx-auto mb-3 text-xl font-black">
                  👨‍🏫
                </div>
                <h3 className="font-bold text-slate-800 text-base">إدارة مجموعات المشاريع</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subjects.length} مواد • {totalGroups} مجموعات • {totalStudents} طالب مسجل
                </p>
              </div>

              {/* Instructions Box */}
              <div className="bg-purple-50 rounded-2xl border border-purple-200/80 p-4 shadow-sm space-y-2">
                <h4 className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-purple-700" />
                  <span>طريقة العمل والرسالة المرسلة للأستاذ</span>
                </h4>
                <p className="text-xs text-purple-800 leading-relaxed bg-white p-3 rounded-xl border border-purple-100">
                  {teacherMessage}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(teacherMessage);
                    showToast('تم نسخ الرسالة للأستاذ بنجاح!');
                  }}
                  className="w-full bg-[#5925dc] hover:bg-[#491cbd] text-white text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ رسالة الأستاذ</span>
                </button>
              </div>

              {/* Settings / Actions */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">الإجراءات والخيارات</h4>
                
                <button 
                  onClick={() => {
                    let allText = `📋 كشف مجموعات المشاريع الكامل:\n\n`;
                    subjects.forEach(s => {
                      allText += `📖 مادة: ${s.name} (الأستاذ: ${s.professorName || 'غير محدد'})\n`;
                      if (s.groups.length === 0) {
                        allText += `  (لا توجد مجموعات)\n`;
                      } else {
                        s.groups.forEach(g => {
                          allText += `  🔹 ${g.name} (${g.members.length} طلاب):\n`;
                          if (g.members.length === 0) {
                            allText += `    - فارغة\n`;
                          } else {
                            g.members.forEach((m, idx) => {
                              allText += `    ${idx + 1}. ${m}\n`;
                            });
                          }
                        });
                      }
                      allText += `\n`;
                    });
                    navigator.clipboard.writeText(allText);
                    showToast('تم نسخ تقرير جميع المواد والمجموعات!');
                  }}
                  className="w-full text-right bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold p-3 rounded-xl text-xs flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-purple-600" />
                    <span>نسخ تقرير شامل بجميع المواد والمجموعات</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}

        </main>

        {/* Bottom Navigation Bar - Pinned at bottom and stays visible during scroll */}
        <nav className="no-print fixed sm:sticky bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)] shrink-0">
          <button 
            onClick={() => {
              setSelectedSubjectId(null);
              setActiveTab('home');
            }}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'home' ? 'text-[#5925dc] font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>الرئيسية (المواد)</span>
          </button>

          <button 
            onClick={() => {
              setActiveTab('groups');
              if (!selectedSubjectId && subjects.length > 0) {
                setSelectedSubjectId(subjects[0].id);
              }
            }}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'groups' ? 'text-[#5925dc] font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {totalGroups > 0 && (
                <span className="absolute -top-1 -left-1 w-2 h-2 bg-[#5925dc] rounded-full"></span>
              )}
            </div>
            <span>المجموعات</span>
          </button>

          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'notifications' ? 'text-[#5925dc] font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {activities.length > 0 && (
                <span className="absolute -top-1 -left-1 w-2 h-2 bg-purple-500 rounded-full"></span>
              )}
            </div>
            <span>الإشعارات</span>
          </button>

          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
              activeTab === 'profile' ? 'text-[#5925dc] font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span>الملف الشخصي</span>
          </button>
        </nav>

        {/* Security Code Verification Modal for Deletion ('imad') */}
        {pendingDelete && (
          <div className="no-print absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-slate-100 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">تأكيد عملية الحذف</h3>
                  <p className="text-[11px] text-slate-400">مطلوب إدخال رمز الأمان لإتمام الحذف</p>
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-100/80 rounded-2xl p-3 mb-3.5 text-xs text-rose-900 leading-relaxed">
                {pendingDelete.type === 'subject' && (
                  <span>
                    هل أنت متأكد من حذف مادة <strong className="font-bold underline">{pendingDelete.subjectName}</strong> بالكامل مع جميع مجموعاتها وطلابها؟
                  </span>
                )}
                {pendingDelete.type === 'group' && (
                  <span>
                    هل أنت متأكد من حذف <strong className="font-bold underline">{pendingDelete.groupName}</strong> بالكامل مع جميع الطلاب المسجلين بها؟
                  </span>
                )}
                {pendingDelete.type === 'member' && (
                  <span>
                    هل أنت متأكد من حذف الطالب <strong className="font-bold underline">"{pendingDelete.memberName}"</strong> من {pendingDelete.groupName}؟
                  </span>
                )}
              </div>

              <form onSubmit={handleConfirmDelete} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                    <span>أدخل رمز التأكيد:</span>
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={deletePasscode}
                    onChange={(e) => {
                      setDeletePasscode(e.target.value);
                      setPasscodeError(null);
                    }}
                    placeholder="اكتب الرمز هنا..."
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 rounded-xl px-3.5 py-2.5 text-sm text-center font-bold tracking-widest outline-none transition"
                  />
                  {passcodeError && (
                    <div className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1 bg-rose-50 py-1.5 px-2.5 rounded-lg border border-rose-200">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>{passcodeError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDelete(null);
                      setDeletePasscode('');
                      setPasscodeError(null);
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PDF Preview and Download Modal */}
        {pdfSubject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Top Bar (hidden in print) */}
              <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base">تحميل كشف المجموعات (PDF)</h3>
                    <p className="text-[11px] text-slate-300">تحميل ملف PDF حقيقي يحتوي فقط على المجموعات وأفرادها</p>
                  </div>
                </div>
                <button
                  onClick={() => setPdfSubject(null)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Buttons Header inside Modal */}
              <div className="no-print bg-emerald-50/70 border-b border-emerald-100 p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="text-xs text-emerald-900 font-semibold flex items-center gap-1.5">
                  <span>المادة:</span>
                  <span className="font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {pdfSubject.name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleDownloadPdf(pdfSubject)}
                    disabled={isGeneratingPdf}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-emerald-400 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="تحميل ملف PDF مباشر لجهازك"
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{isGeneratingPdf ? 'جاري التحميل...' : 'تحميل PDF (ملف جاهز)'}</span>
                  </button>
                  <button
                    onClick={handlePrintPdf}
                    className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs px-2.5 py-2 rounded-xl transition flex items-center gap-1 shadow-xs cursor-pointer"
                    title="طباعة أو حفظ مباشر عبر المتصفح"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>طباعة</span>
                  </button>
                  <button
                    onClick={() => handleShareSubjectWhatsApp(pdfSubject)}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs px-2.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title="مشاركة المجموعات في واتساب"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>واتساب</span>
                  </button>
                  <button
                    onClick={() => handleCopySubjectGroups(pdfSubject)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title="نسخ قائمة المجموعات والأسماء"
                  >
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>نسخ</span>
                  </button>
                </div>
              </div>

              {/* Printable PDF Document View */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
                <div 
                  id="printable-groups-pdf-content" 
                  className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-slate-800 space-y-5"
                >
                  {/* Clean Document Header (Subject and Professor info only, no code) */}
                  <div className="border-b-2 border-[#5925dc] pb-3 text-center">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
                      كشف مجموعات مادة: {pdfSubject.name}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 mt-2">
                      <span className="bg-purple-50 text-purple-800 font-bold px-2.5 py-1 rounded-lg border border-purple-100">
                        👨‍🏫 الأستاذ المشرف: {pdfSubject.professorName || 'أستاذ المادة'}
                      </span>
                      <span className="bg-slate-50 text-slate-600 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                        📅 التاريخ: {new Date().toLocaleDateString('ar-EG')}
                      </span>
                      <span className="bg-slate-50 text-slate-600 font-medium px-2.5 py-1 rounded-lg border border-slate-200">
                        👥 إجمالي المجموعات: {pdfSubject.groups.length}
                      </span>
                    </div>
                  </div>

                  {/* Groups: STRICTLY Group Names and their Members */}
                  <div className="space-y-4">
                    {pdfSubject.groups.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs italic">
                        لا توجد أي مجموعة مسجلة في هذه المادة بعد.
                      </div>
                    ) : (
                      pdfSubject.groups.map((group) => (
                        <div key={group.id} className="border border-slate-300 rounded-xl overflow-hidden page-break-inside-avoid">
                          {/* Group Name Banner */}
                          <div className="bg-[#5925dc] text-white px-4 py-2 text-sm font-bold flex items-center justify-between">
                            <span className="text-base">{group.name}</span>
                            <span className="text-purple-100 text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-semibold">
                              {group.members.length} {group.members.length === 1 ? 'طالب' : 'طلبة'}
                            </span>
                          </div>

                          {/* Members / Students in this group */}
                          {group.members.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400 italic">
                              لا يوجد طلبة مسجلين في هذه المجموعة حتى الآن
                            </div>
                          ) : (
                            <table className="w-full text-right text-xs">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5 w-12 text-center font-bold">#</th>
                                  <th className="p-2.5 font-bold">اسم ولقب الطالب</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.members.map((member, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                    <td className="p-2.5 text-center font-bold text-purple-700 bg-purple-50/30">{idx + 1}</td>
                                    <td className="p-2.5 font-bold text-slate-800 text-sm">{member}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="no-print bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500">
                  كشف رسمي ومنظم يقتصر على أسماء المجموعات وأفرادها فقط
                </span>
                <button
                  onClick={() => setPdfSubject(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
