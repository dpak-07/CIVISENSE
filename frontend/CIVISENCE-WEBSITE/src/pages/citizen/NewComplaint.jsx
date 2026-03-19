import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineCamera, HiOutlineMapPin, HiOutlinePaperAirplane, HiOutlineXMark } from 'react-icons/hi2';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { createComplaint } from '../../api/complaints';
import { getErrorMessage } from '../../utils/helpers';

const CATEGORIES = [
    'Road Damage',
    'Water Supply',
    'Sewage',
    'Electricity',
    'Garbage',
    'Street Light',
    'Public Safety',
    'Noise Pollution',
    'Illegal Construction',
    'Other'
];

export default function NewComplaint() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: '',
        longitude: '',
        latitude: ''
    });
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    const handleChange = (event) => {
        setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleImage = (event) => {
        const file = event.target.files?.[0] || null;
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const clearImage = () => {
        setImage(null);
        setImagePreview(null);
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setForm((prev) => ({
                    ...prev,
                    longitude: position.coords.longitude.toString(),
                    latitude: position.coords.latitude.toString()
                }));
                setGettingLocation(false);
            },
            () => {
                setError('Unable to retrieve your location.');
                setGettingLocation(false);
            }
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.longitude || !form.latitude) {
            setError('Location is required. Use current location or enter coordinates manually.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', form.title);
            formData.append('description', form.description);
            formData.append('category', form.category);
            formData.append('longitude', form.longitude);
            formData.append('latitude', form.latitude);
            if (image) formData.append('image', image);

            await createComplaint(formData);
            navigate('/citizen', { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Report a civic issue</h1>
                    <p>Submit a clear title, useful description, optional evidence, and location so the issue can be routed correctly.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] lg:p-8">
                    {error ? <div className="auth-error">{error}</div> : null}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="input-group">
                            <label htmlFor="title">Title</label>
                            <input
                                id="title"
                                name="title"
                                className="input"
                                placeholder="Brief title of the issue"
                                value={form.title}
                                onChange={handleChange}
                                required
                                maxLength={200}
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="category">Category</label>
                            <select
                                id="category"
                                name="category"
                                className="input"
                                value={form.category}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select category</option>
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                className="input"
                                placeholder="Describe the issue in detail..."
                                value={form.description}
                                onChange={handleChange}
                                required
                                rows={6}
                                maxLength={5000}
                            />
                        </div>

                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Location</p>
                                    <p className="mt-2 text-sm text-slate-600">Use your current location or manually enter coordinates.</p>
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={getLocation} disabled={gettingLocation}>
                                    <HiOutlineMapPin />
                                    {gettingLocation ? 'Getting location...' : 'Use current location'}
                                </button>
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <input
                                    name="latitude"
                                    className="input"
                                    placeholder="Latitude"
                                    value={form.latitude}
                                    onChange={handleChange}
                                    type="number"
                                    step="any"
                                />
                                <input
                                    name="longitude"
                                    className="input"
                                    placeholder="Longitude"
                                    value={form.longitude}
                                    onChange={handleChange}
                                    type="number"
                                    step="any"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                <HiOutlinePaperAirplane />
                                {loading ? 'Submitting...' : 'Submit complaint'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Evidence upload</p>
                        <label
                            htmlFor="image-upload"
                            className="mt-4 flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-sky-300 hover:bg-sky-50/40"
                        >
                            {imagePreview ? (
                                <div className="relative h-full w-full">
                                    <img src={imagePreview} alt="Preview" className="h-full w-full rounded-[1.25rem] object-cover" />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 text-white"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            clearImage();
                                        }}
                                    >
                                        <HiOutlineXMark />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl text-sky-700 shadow-sm">
                                        <HiOutlineCamera />
                                    </div>
                                    <h2 className="mt-4 text-2xl font-bold text-slate-950">Add a supporting photo</h2>
                                    <p className="mt-2 max-w-sm text-sm leading-7 text-slate-600">
                                        Uploading an image helps officers review the issue faster and improves triage accuracy.
                                    </p>
                                </>
                            )}
                        </label>
                        <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImage} />
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] p-6 text-white shadow-[0_26px_80px_-42px_rgba(15,23,42,0.7)]">
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-200">Submission tips</p>
                        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
                            <li>Use a specific title so the issue can be understood quickly.</li>
                            <li>Include nearby landmarks in the description when relevant.</li>
                            <li>Verify location before submitting so routing reaches the correct office.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
