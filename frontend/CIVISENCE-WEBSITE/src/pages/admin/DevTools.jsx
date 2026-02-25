import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
    getDevToolsData,
    updateDevAppConfig,
    updateDevUser,
    deleteDevUser
} from '../../api/admin';
import { getErrorMessage } from '../../utils/helpers';
import {
    HiOutlineArrowRightOnRectangle,
    HiOutlineArrowTopRightOnSquare,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import './DevTools.css';

const emptyConfig = {
    androidApkUrl: '',
    iosNote: ''
};

export default function DevTools() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [loading, setLoading] = useState(true);
    const [savingConfig, setSavingConfig] = useState(false);
    const [savingUsers, setSavingUsers] = useState({});
    const [deletingUsers, setDeletingUsers] = useState({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [configForm, setConfigForm] = useState(emptyConfig);
    const [admins, setAdmins] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [drafts, setDrafts] = useState({});

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await getDevToolsData();
            const payload = data.data;
            setAdmins(payload.admins || []);
            setOfficers(payload.officers || []);
            setConfigForm({
                androidApkUrl: payload.appConfig?.androidApkUrl || '',
                iosNote: payload.appConfig?.iosNote || ''
            });

            const nextDrafts = {};
            [...(payload.admins || []), ...(payload.officers || [])].forEach((item) => {
                nextDrafts[item.id] = {
                    name: item.name || '',
                    email: item.email || '',
                    isActive: item.isActive !== false,
                    password: ''
                };
            });
            setDrafts(nextDrafts);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const filteredOfficers = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        if (!keyword) return officers;
        return officers.filter((officer) =>
            [officer.name, officer.email, officer.officeName]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword))
        );
    }, [officers, search]);

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
        if (draft.email.trim().toLowerCase() !== (targetUser.email || '')) payload.email = draft.email.trim().toLowerCase();
        if (Boolean(draft.isActive) !== Boolean(targetUser.isActive)) payload.isActive = Boolean(draft.isActive);
        if (draft.password) payload.password = draft.password;

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

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const renderUserCard = (targetUser) => {
        const draft = drafts[targetUser.id] || {};
        const isSelf = String(targetUser.id) === String(user?.id || '');

        return (
            <article key={targetUser.id} className="dev-user-card card">
                <div className="dev-user-card__head">
                    <h4>{targetUser.name}</h4>
                    <span className={`dev-role-pill dev-role-pill--${targetUser.role}`}>
                        {targetUser.role.replace('_', ' ')}
                    </span>
                </div>
                {targetUser.officeName && <p className="dev-user-card__office">{targetUser.officeName}</p>}

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
                        <p>Manage APK links, admin accounts, and sub-office credentials from one place.</p>
                    </div>
                </div>

                {error && <div className="auth-error">{error}</div>}
                {success && <div className="dev-success">{success}</div>}

                <section className="dev-section card">
                    <h3>App Distribution Settings</h3>
                    <form className="dev-config-form" onSubmit={handleConfigSave}>
                        <div className="input-group">
                            <label>Android APK URL</label>
                            <input
                                className="input"
                                value={configForm.androidApkUrl}
                                onChange={(event) => setConfigForm((prev) => ({ ...prev, androidApkUrl: event.target.value }))}
                                required
                            />
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
                        <button type="submit" className="btn btn-success" disabled={savingConfig}>
                            {savingConfig ? 'Saving...' : 'Save App Settings'}
                        </button>
                    </form>
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
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
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
            </main>
        </div>
    );
}
