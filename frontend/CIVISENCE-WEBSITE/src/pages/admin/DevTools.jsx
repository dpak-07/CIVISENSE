import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
    getDevToolsData,
    updateDevAppConfig,
    uploadDevAppApk,
    createDevDeveloper,
    updateDevDeveloper,
    deleteDevDeveloper,
    updateDevUser,
    deleteDevUser
} from '../../api/admin';
import { getErrorMessage } from '../../utils/helpers';
import {
    HiOutlineArrowRightOnRectangle,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineArrowUpTray,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import './DevTools.css';

const emptyConfig = {
    androidApkUrl: '',
    iosNote: ''
};

const emptyDeveloper = {
    profileType: 'team',
    name: '',
    role: '',
    description: '',
    photoUrl: '',
    skills: '',
    highlights: '',
    github: '#',
    linkedin: '#',
    portfolio: '#',
    displayOrder: 100,
    isActive: true
};

const adminShortcuts = [
    { label: 'Admin Dashboard', path: '/admin' },
    { label: 'Complaints', path: '/admin/complaints' },
    { label: 'Municipal Offices', path: '/admin/offices' },
    { label: 'Sensitive Zones', path: '/admin/zones' },
    { label: 'Analytics', path: '/admin/analytics' }
];

export default function DevTools() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [loading, setLoading] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);
    const [uploadingApk, setUploadingApk] = useState(false);
    const [savingUsers, setSavingUsers] = useState({});
    const [deletingUsers, setDeletingUsers] = useState({});
    const [savingDevelopers, setSavingDevelopers] = useState({});
    const [deletingDevelopers, setDeletingDevelopers] = useState({});
    const [creatingDeveloper, setCreatingDeveloper] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [officeSearch, setOfficeSearch] = useState('');
    const [citizenSearch, setCitizenSearch] = useState('');
    const [configForm, setConfigForm] = useState(emptyConfig);
    const [admins, setAdmins] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [citizens, setCitizens] = useState([]);
    const [developers, setDevelopers] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [developerDrafts, setDeveloperDrafts] = useState({});
    const [newDeveloper, setNewDeveloper] = useState(emptyDeveloper);

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await getDevToolsData();
            const payload = data.data;
            const adminList = payload.admins || [];
            const officerList = payload.officers || [];
            const citizenList = payload.citizens || [];
            const developerList = (payload.developers || []).map((item) => ({
                id: item.id,
                profileType: item.profileType === 'mentor' ? 'mentor' : 'team',
                name: item.name || '',
                role: item.role || '',
                description: item.description || '',
                photoUrl: item.photoUrl || '',
                skills: Array.isArray(item.skills) ? item.skills : [],
                highlights: Array.isArray(item.highlights) ? item.highlights : [],
                socials: {
                    github: item.socials?.github || '#',
                    linkedin: item.socials?.linkedin || '#',
                    portfolio: item.socials?.portfolio || '#'
                },
                displayOrder: Number(item.displayOrder || 100),
                isActive: item.isActive !== false
            }));

            setAdmins(adminList);
            setOfficers(officerList);
            setCitizens(citizenList);
            setDevelopers(developerList);
            setConfigForm({
                androidApkUrl: payload.appConfig?.androidApkUrl || '',
                iosNote: payload.appConfig?.iosNote || ''
            });

            const nextDrafts = {};
            [...adminList, ...officerList, ...citizenList].forEach((item) => {
                nextDrafts[item.id] = {
                    name: item.name || '',
                    email: item.email || '',
                    isActive: item.isActive !== false,
                    password: '',
                    isBlacklisted: item.isBlacklisted === true,
                    blacklistReason: item.blacklistReason || ''
                };
            });
            setDrafts(nextDrafts);

            const nextDeveloperDrafts = {};
            developerList.forEach((item) => {
                nextDeveloperDrafts[item.id] = {
                    profileType: item.profileType,
                    name: item.name,
                    role: item.role,
                    description: item.description,
                    photoUrl: item.photoUrl || '',
                    skills: item.skills.join(', '),
                    highlights: item.highlights.join(', '),
                    github: item.socials?.github || '#',
                    linkedin: item.socials?.linkedin || '#',
                    portfolio: item.socials?.portfolio || '#',
                    displayOrder: Number(item.displayOrder || 100),
                    isActive: item.isActive !== false
                };
            });
            setDeveloperDrafts(nextDeveloperDrafts);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const filteredOfficers = useMemo(() => {
        const keyword = officeSearch.trim().toLowerCase();
        if (!keyword) return officers;
        return officers.filter((officer) =>
            [officer.name, officer.email, officer.officeName]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        );
    }, [officers, officeSearch]);

    const filteredCitizens = useMemo(() => {
        const keyword = citizenSearch.trim().toLowerCase();
        if (!keyword) return citizens;
        return citizens.filter((citizen) =>
            [citizen.name, citizen.email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        );
    }, [citizens, citizenSearch]);

    const toList = (value) =>
        String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    const handleConfigSave = async (event) => {
        event.preventDefault();
        setSavingConfig(true);
        setError('');
        setSuccess('');
        try {
            await updateDevAppConfig({
                androidApkUrl: configForm.androidApkUrl,
                iosNote: configForm.iosNote
            });
            setSuccess('App distribution settings updated.');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSavingConfig(false);
        }
    };

    const handleApkUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setUploadingApk(true);
        setError('');
        setSuccess('');
        try {
            const formData = new FormData();
            formData.append('apk', file);
            const response = await uploadDevAppApk(formData);
            const nextApkUrl =
                response?.data?.data?.uploadedApkUrl || response?.data?.data?.androidApkUrl || '';

            if (nextApkUrl) {
                setConfigForm((prev) => ({ ...prev, androidApkUrl: nextApkUrl }));
            }

            setSuccess('APK uploaded to S3 and Android APK URL updated.');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            event.target.value = '';
            setUploadingApk(false);
        }
    };

    const updateDraft = (userId, key, value) => {
        setDrafts((prev) => ({
            ...prev,
            [userId]: {
                ...(prev[userId] || {}),
                [key]: value
            }
        }));
    };

    const saveUser = async (targetUser) => {
        const draft = drafts[targetUser.id];
        if (!draft) return;

        const payload = {};
        if (draft.name.trim() !== (targetUser.name || '')) payload.name = draft.name.trim();
        if (draft.email.trim().toLowerCase() !== (targetUser.email || '')) {
            payload.email = draft.email.trim().toLowerCase();
        }
        if (Boolean(draft.isActive) !== Boolean(targetUser.isActive)) payload.isActive = Boolean(draft.isActive);
        if (draft.password) payload.password = draft.password;

        if (targetUser.role === 'citizen') {
            if (Boolean(draft.isBlacklisted) !== Boolean(targetUser.isBlacklisted)) {
                payload.isBlacklisted = Boolean(draft.isBlacklisted);
            }

            const nextReason = String(draft.blacklistReason || '').trim();
            const prevReason = String(targetUser.blacklistReason || '').trim();
            if (nextReason && nextReason !== prevReason) {
                payload.blacklistReason = nextReason;
            }
        }

        if (Object.keys(payload).length === 0) {
            setSuccess('No changes to save for this account.');
            return;
        }

        setSavingUsers((prev) => ({ ...prev, [targetUser.id]: true }));
        setError('');
        setSuccess('');
        try {
            await updateDevUser(targetUser.id, payload);
            setSuccess(`Updated ${targetUser.name}`);
            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSavingUsers((prev) => ({ ...prev, [targetUser.id]: false }));
        }
    };

    const removeUser = async (targetUser) => {
        if (String(targetUser.id) === String(user?.id || '')) {
            setError('You cannot delete your own active account.');
            return;
        }

        if (!window.confirm(`Delete ${targetUser.name}? This action cannot be undone.`)) {
            return;
        }

        setDeletingUsers((prev) => ({ ...prev, [targetUser.id]: true }));
        setError('');
        setSuccess('');
        try {
            await deleteDevUser(targetUser.id);
            setSuccess(`Deleted ${targetUser.name}`);
            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeletingUsers((prev) => ({ ...prev, [targetUser.id]: false }));
        }
    };

    const updateDeveloperDraft = (developerId, key, value) => {
        setDeveloperDrafts((prev) => ({
            ...prev,
            [developerId]: {
                ...(prev[developerId] || {}),
                [key]: value
            }
        }));
    };

    const saveDeveloperProfile = async (developer) => {
        const draft = developerDrafts[developer.id];
        if (!draft) return;

        const payload = {
            profileType: draft.profileType === 'mentor' ? 'mentor' : 'team',
            name: String(draft.name || '').trim(),
            role: String(draft.role || '').trim(),
            description: String(draft.description || '').trim(),
            photoUrl: String(draft.photoUrl || '').trim(),
            skills: toList(draft.skills),
            highlights: toList(draft.highlights),
            socials: {
                github: String(draft.github || '#').trim() || '#',
                linkedin: String(draft.linkedin || '#').trim() || '#',
                portfolio: String(draft.portfolio || '#').trim() || '#'
            },
            displayOrder: Number(draft.displayOrder || 0),
            isActive: Boolean(draft.isActive)
        };

        if (!payload.name || !payload.role || !payload.description) {
            setError('Developer name, role, and description are required.');
            return;
        }

        setSavingDevelopers((prev) => ({ ...prev, [developer.id]: true }));
        setError('');
        setSuccess('');
        try {
            await updateDevDeveloper(developer.id, payload);
            setSuccess(`Updated developer profile: ${payload.name}`);
            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSavingDevelopers((prev) => ({ ...prev, [developer.id]: false }));
        }
    };

    const removeDeveloperProfile = async (developer) => {
        if (!window.confirm(`Delete developer profile for ${developer.name}?`)) {
            return;
        }

        setDeletingDevelopers((prev) => ({ ...prev, [developer.id]: true }));
        setError('');
        setSuccess('');
        try {
            await deleteDevDeveloper(developer.id);
            setSuccess(`Deleted developer profile: ${developer.name}`);
            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeletingDevelopers((prev) => ({ ...prev, [developer.id]: false }));
        }
    };

    const createDeveloperProfileRecord = async (event) => {
        event.preventDefault();

        const payload = {
            profileType: newDeveloper.profileType === 'mentor' ? 'mentor' : 'team',
            name: String(newDeveloper.name || '').trim(),
            role: String(newDeveloper.role || '').trim(),
            description: String(newDeveloper.description || '').trim(),
            photoUrl: String(newDeveloper.photoUrl || '').trim(),
            skills: toList(newDeveloper.skills),
            highlights: toList(newDeveloper.highlights),
            socials: {
                github: String(newDeveloper.github || '#').trim() || '#',
                linkedin: String(newDeveloper.linkedin || '#').trim() || '#',
                portfolio: String(newDeveloper.portfolio || '#').trim() || '#'
            },
            displayOrder: Number(newDeveloper.displayOrder || 0),
            isActive: Boolean(newDeveloper.isActive)
        };

        if (!payload.name || !payload.role || !payload.description) {
            setError('New developer profile requires name, role, and description.');
            return;
        }

        setCreatingDeveloper(true);
        setError('');
        setSuccess('');
        try {
            await createDevDeveloper(payload);
            setSuccess(`Created developer profile: ${payload.name}`);
            setNewDeveloper(emptyDeveloper);
            await loadData();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setCreatingDeveloper(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const renderDeveloperCard = (developer) => {
        const draft = developerDrafts[developer.id] || emptyDeveloper;

        return (
            <article key={developer.id} className="dev-user-card card dev-developer-card">
                <div className="dev-user-card__head">
                    <h4>{developer.name}</h4>
                    <span className={`dev-role-pill dev-role-pill--${draft.profileType}`}>
                        {draft.profileType}
                    </span>
                </div>

                <div className="dev-user-card__form">
                    <div className="input-group">
                        <label>Profile Type</label>
                        <select
                            className="input"
                            value={draft.profileType || 'team'}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'profileType', event.target.value)}
                        >
                            <option value="team">Team Member</option>
                            <option value="mentor">Mentor</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Name</label>
                        <input
                            className="input"
                            value={draft.name || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'name', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Role</label>
                        <input
                            className="input"
                            value={draft.role || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'role', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Description</label>
                        <textarea
                            className="input"
                            rows={4}
                            value={draft.description || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'description', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Photo URL</label>
                        <input
                            className="input"
                            value={draft.photoUrl || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'photoUrl', event.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                    <div className="input-group">
                        <label>Skills (comma separated)</label>
                        <input
                            className="input"
                            value={draft.skills || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'skills', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Highlights (comma separated)</label>
                        <input
                            className="input"
                            value={draft.highlights || ''}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'highlights', event.target.value)}
                        />
                    </div>

                    <div className="dev-developer-social-grid">
                        <div className="input-group">
                            <label>GitHub</label>
                            <input
                                className="input"
                                value={draft.github || '#'}
                                onChange={(event) => updateDeveloperDraft(developer.id, 'github', event.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label>LinkedIn</label>
                            <input
                                className="input"
                                value={draft.linkedin || '#'}
                                onChange={(event) => updateDeveloperDraft(developer.id, 'linkedin', event.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label>Portfolio</label>
                            <input
                                className="input"
                                value={draft.portfolio || '#'}
                                onChange={(event) => updateDeveloperDraft(developer.id, 'portfolio', event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Display Order</label>
                        <input
                            className="input"
                            type="number"
                            min={0}
                            value={draft.displayOrder}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'displayOrder', event.target.value)}
                        />
                    </div>

                    <label className="dev-user-card__toggle">
                        <input
                            type="checkbox"
                            checked={Boolean(draft.isActive)}
                            onChange={(event) => updateDeveloperDraft(developer.id, 'isActive', event.target.checked)}
                        />
                        Active on public developers page
                    </label>
                </div>

                <div className="dev-user-card__actions">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={Boolean(savingDevelopers[developer.id])}
                        onClick={() => void saveDeveloperProfile(developer)}
                    >
                        {savingDevelopers[developer.id] ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={Boolean(deletingDevelopers[developer.id])}
                        onClick={() => void removeDeveloperProfile(developer)}
                    >
                        {deletingDevelopers[developer.id] ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </article>
        );
    };

    const renderUserCard = (targetUser) => {
        const draft = drafts[targetUser.id] || {};
        const isSelf = String(targetUser.id) === String(user?.id || '');
        const isCitizen = targetUser.role === 'citizen';

        return (
            <article key={targetUser.id} className="dev-user-card card">
                <div className="dev-user-card__head">
                    <h4>{targetUser.name}</h4>
                    <span className={`dev-role-pill dev-role-pill--${targetUser.role}`}>
                        {targetUser.role.replace('_', ' ')}
                    </span>
                </div>

                {targetUser.officeName && <p className="dev-user-card__office">{targetUser.officeName}</p>}

                {isCitizen ? (
                    <div className="dev-citizen-stats">
                        <span className={`dev-citizen-pill ${targetUser.isBlacklisted ? 'danger' : 'ok'}`}>
                            {targetUser.isBlacklisted ? 'Blacklisted' : 'Active Citizen'}
                        </span>
                        <span className="dev-citizen-pill neutral">
                            Reports: {Number(targetUser.misuseReportCount || 0)}
                        </span>
                    </div>
                ) : null}

                <div className="dev-user-card__form">
                    <div className="input-group">
                        <label>Name</label>
                        <input
                            className="input"
                            value={draft.name || ''}
                            onChange={(event) => updateDraft(targetUser.id, 'name', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>Email / Login ID</label>
                        <input
                            className="input"
                            value={draft.email || ''}
                            onChange={(event) => updateDraft(targetUser.id, 'email', event.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label>New Password</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="Keep empty to not change"
                            value={draft.password || ''}
                            onChange={(event) => updateDraft(targetUser.id, 'password', event.target.value)}
                        />
                    </div>

                    <label className="dev-user-card__toggle">
                        <input
                            type="checkbox"
                            checked={Boolean(draft.isActive)}
                            onChange={(event) => updateDraft(targetUser.id, 'isActive', event.target.checked)}
                        />
                        Active
                    </label>

                    {isCitizen ? (
                        <>
                            <label className="dev-user-card__toggle dev-user-card__toggle--danger">
                                <input
                                    type="checkbox"
                                    checked={Boolean(draft.isBlacklisted)}
                                    onChange={(event) => updateDraft(targetUser.id, 'isBlacklisted', event.target.checked)}
                                />
                                Blacklist User
                            </label>
                            <div className="input-group">
                                <label>Blacklist Reason</label>
                                <input
                                    className="input"
                                    value={draft.blacklistReason || ''}
                                    placeholder="Reason shown to user"
                                    onChange={(event) => updateDraft(targetUser.id, 'blacklistReason', event.target.value)}
                                />
                            </div>
                        </>
                    ) : null}
                </div>

                <div className="dev-user-card__actions">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={Boolean(savingUsers[targetUser.id])}
                        onClick={() => void saveUser(targetUser)}
                    >
                        {savingUsers[targetUser.id] ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={Boolean(deletingUsers[targetUser.id]) || isSelf}
                        onClick={() => void removeUser(targetUser)}
                        title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                    >
                        {deletingUsers[targetUser.id] ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </article>
        );
    };

    if (loading) {
        return (
            <div className="dev-console-page">
                <LoadingSpinner fullPage />
            </div>
        );
    }

    return (
        <div className="dev-console-page">
            <header className="dev-console-topbar glass">
                <div className="dev-console-topbar__left">
                    <div className="dev-console-brand">
                        <span className="dev-console-brand__icon"><HiOutlineWrenchScrewdriver /></span>
                        <div>
                            <strong>Dev Tools</strong>
                            <p>Super Admin Console</p>
                        </div>
                    </div>
                </div>
                <div className="dev-console-topbar__right">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
                        <HiOutlineArrowTopRightOnSquare /> Admin Portal
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                        <HiOutlineArrowRightOnRectangle /> Logout
                    </button>
                </div>
            </header>

            <main className="dev-console-main container">
                <div className="page-header">
                    <div>
                        <h1>Developer Console</h1>
                        <p>APK release management, admin operations, and complete user controls from one screen.</p>
                    </div>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="dev-success">{success}</div>}

                <section className="dev-section card">
                    <h3>Admin Function Shortcuts</h3>
                    <div className="dev-shortcuts">
                        {adminShortcuts.map((item) => (
                            <button
                                key={item.path}
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => navigate(item.path)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="dev-section card">
                    <h3>App Distribution Settings</h3>
                    <form className="dev-config-form" onSubmit={handleConfigSave}>
                        <div className="input-group">
                            <label>Android APK URL (S3 / external)</label>
                            <input
                                className="input"
                                value={configForm.androidApkUrl}
                                onChange={(event) => setConfigForm((prev) => ({ ...prev, androidApkUrl: event.target.value }))}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Upload APK File to S3</label>
                            <label className="dev-upload-field">
                                <HiOutlineArrowUpTray />
                                <span>{uploadingApk ? 'Uploading...' : 'Choose APK and Upload'}</span>
                                <input
                                    type="file"
                                    accept=".apk,application/vnd.android.package-archive"
                                    onChange={handleApkUpload}
                                    disabled={uploadingApk}
                                />
                            </label>
                            <small className="dev-help-text">
                                Uploading will push file to S3 and auto-update Android APK URL.
                            </small>
                        </div>
                        <div className="input-group">
                            <label>iOS Note</label>
                            <textarea
                                className="input"
                                rows={3}
                                value={configForm.iosNote}
                                onChange={(event) => setConfigForm((prev) => ({ ...prev, iosNote: event.target.value }))}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-success" disabled={savingConfig || uploadingApk}>
                            {savingConfig ? 'Saving...' : 'Save App Settings'}
                        </button>
                    </form>
                </section>

                <section className="dev-section card">
                    <h3>Developer Team Profile CMS</h3>
                    <p className="dev-help-text">These records power the public <code>/developers</code> page dynamically.</p>

                    <form className="dev-config-form dev-create-developer" onSubmit={createDeveloperProfileRecord}>
                        <div className="input-group">
                            <label>Profile Type</label>
                            <select
                                className="input"
                                value={newDeveloper.profileType}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, profileType: event.target.value }))}
                            >
                                <option value="team">Team Member</option>
                                <option value="mentor">Mentor</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Name</label>
                            <input
                                className="input"
                                value={newDeveloper.name}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, name: event.target.value }))}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Role</label>
                            <input
                                className="input"
                                value={newDeveloper.role}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, role: event.target.value }))}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Description</label>
                            <textarea
                                className="input"
                                rows={3}
                                value={newDeveloper.description}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, description: event.target.value }))}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Photo URL</label>
                            <input
                                className="input"
                                value={newDeveloper.photoUrl}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, photoUrl: event.target.value }))}
                            />
                        </div>
                        <div className="input-group">
                            <label>Skills (comma separated)</label>
                            <input
                                className="input"
                                value={newDeveloper.skills}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, skills: event.target.value }))}
                            />
                        </div>
                        <div className="input-group">
                            <label>Highlights (comma separated)</label>
                            <input
                                className="input"
                                value={newDeveloper.highlights}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, highlights: event.target.value }))}
                            />
                        </div>
                        <div className="dev-developer-social-grid">
                            <div className="input-group">
                                <label>GitHub</label>
                                <input
                                    className="input"
                                    value={newDeveloper.github}
                                    onChange={(event) => setNewDeveloper((prev) => ({ ...prev, github: event.target.value }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>LinkedIn</label>
                                <input
                                    className="input"
                                    value={newDeveloper.linkedin}
                                    onChange={(event) => setNewDeveloper((prev) => ({ ...prev, linkedin: event.target.value }))}
                                />
                            </div>
                            <div className="input-group">
                                <label>Portfolio</label>
                                <input
                                    className="input"
                                    value={newDeveloper.portfolio}
                                    onChange={(event) => setNewDeveloper((prev) => ({ ...prev, portfolio: event.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Display Order</label>
                            <input
                                className="input"
                                type="number"
                                min={0}
                                value={newDeveloper.displayOrder}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, displayOrder: event.target.value }))}
                            />
                        </div>
                        <label className="dev-user-card__toggle">
                            <input
                                type="checkbox"
                                checked={Boolean(newDeveloper.isActive)}
                                onChange={(event) => setNewDeveloper((prev) => ({ ...prev, isActive: event.target.checked }))}
                            />
                            Active
                        </label>
                        <button type="submit" className="btn btn-success" disabled={creatingDeveloper}>
                            {creatingDeveloper ? 'Creating...' : 'Add Developer Profile'}
                        </button>
                    </form>
                </section>

                <section className="dev-section">
                    <div className="section-title">
                        <h2>Developer Profiles (Dynamic Public Page)</h2>
                    </div>
                    {developers.length === 0 ? (
                        <EmptyState title="No developer profiles" message="Add profiles to power the public developers page." />
                    ) : (
                        <div className="dev-user-grid">
                            {developers.map((developer) => renderDeveloperCard(developer))}
                        </div>
                    )}
                </section>

                <section className="dev-section">
                    <div className="section-title">
                        <h2>Main / Admin Accounts</h2>
                    </div>
                    {admins.length === 0 ? (
                        <EmptyState title="No admin accounts" message="No admin users found." />
                    ) : (
                        <div className="dev-user-grid">
                            {admins.map((admin) => renderUserCard(admin))}
                        </div>
                    )}
                </section>

                <section className="dev-section">
                    <div className="section-title dev-section__with-search">
                        <h2>Sub Office Accounts</h2>
                        <input
                            className="input dev-search"
                            placeholder="Search office / email / name"
                            value={officeSearch}
                            onChange={(event) => setOfficeSearch(event.target.value)}
                        />
                    </div>
                    {filteredOfficers.length === 0 ? (
                        <EmptyState title="No matching office accounts" message="Try a different search query." />
                    ) : (
                        <div className="dev-user-grid">
                            {filteredOfficers.map((officer) => renderUserCard(officer))}
                        </div>
                    )}
                </section>

                <section className="dev-section">
                    <div className="section-title dev-section__with-search">
                        <h2>Citizen User Management</h2>
                        <input
                            className="input dev-search"
                            placeholder="Search citizen name / email"
                            value={citizenSearch}
                            onChange={(event) => setCitizenSearch(event.target.value)}
                        />
                    </div>
                    {filteredCitizens.length === 0 ? (
                        <EmptyState title="No citizens found" message="Try a different search query." />
                    ) : (
                        <div className="dev-user-grid">
                            {filteredCitizens.map((citizen) => renderUserCard(citizen))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
