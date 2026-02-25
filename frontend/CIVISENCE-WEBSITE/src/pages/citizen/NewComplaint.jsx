import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { createComplaint } from '../../api/complaints';
import { getErrorMessage } from '../../utils/helpers';
import './NewComplaint.css';

const CATEGORIES = [
    'Road Damage', 'Water Supply', 'Sewage', 'Electricity', 'Garbage',
    'Street Light', 'Public Safety', 'Noise Pollution', 'Illegal Construction', 'Other'
];

export default function NewComplaint() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '', description: '', category: '', longitude: '', latitude: ''
    });
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm({
                    ...form,
                    longitude: pos.coords.longitude.toString(),
                    latitude: pos.coords.latitude.toString()
                });
                setGettingLocation(false);
            },
            () => {
                setError('Unable to retrieve your location');
                setGettingLocation(false);
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.longitude || !form.latitude) {
            setError('Location is required. Use "Get My Location" or enter coordinates manually.');
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
                    <h1>Report a Complaint</h1>
                    <p>Provide details about the civic issue you want to report</p>
                </div>
            </div>

            <div className="new-complaint-card card">
                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="new-complaint-form">
                    <div className="input-group">
                        <label htmlFor="title">Title *</label>
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
                        <label htmlFor="category">Category *</label>
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
                        <label htmlFor="description">Description *</label>
                        <textarea
                            id="description"
                            name="description"
                            className="input"
                            placeholder="Describe the issue in detail..."
                            value={form.description}
                            onChange={handleChange}
                            required
                            rows={5}
                            maxLength={5000}
                        />
                    </div>

                    <div className="input-group">
                        <label>Image (optional)</label>
                        <div className="file-upload">
                            <input type="file" accept="image/*" onChange={handleImage} id="image-upload" />
                            <label htmlFor="image-upload" className="file-upload__label">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="file-upload__preview" />
                                ) : (
                                    <span>Click to upload an image</span>
                                )}
                            </label>
                        </div>
                    </div>

                    <div className="location-section">
                        <label>Location *</label>
                        <div className="location-inputs">
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
                            <button type="button" className="btn btn-secondary" onClick={getLocation} disabled={gettingLocation}>
                                {gettingLocation ? 'Getting...' : '📍 Get My Location'}
                            </button>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
