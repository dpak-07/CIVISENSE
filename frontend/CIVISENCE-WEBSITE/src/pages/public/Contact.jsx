import { useState } from 'react';
import { HiOutlineEnvelope, HiOutlineMapPin, HiOutlinePhone } from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import { sendContactMessage } from '../../api/public';
import { getErrorMessage } from '../../utils/helpers';
import './Contact.css';

const EMPTY_FORM = {
    name: '',
    email: '',
    subject: '',
    message: ''
};

export default function Contact() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);
        try {
            await sendContactMessage(form);
            setSuccess(true);
            setForm(EMPTY_FORM);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PublicLayout>
            <section className="contact-page__hero">
                <div className="container">
                    <span className="section-tag">Contact CiviSense</span>
                    <h1>Talk to the team about deployment, partnerships, or support.</h1>
                    <p>
                        Use this form to connect with the project team. Your message is delivered directly
                        to the configured support inbox.
                    </p>
                </div>
            </section>

            <section className="contact-page__content">
                <div className="container contact-grid">
                    <aside className="contact-info card">
                        <h3>Reach Out</h3>
                        <div className="contact-info__item">
                            <span><HiOutlineEnvelope /></span>
                            <div>
                                <strong>Email</strong>
                                <p>support@civisense.com</p>
                            </div>
                        </div>
                        <div className="contact-info__item">
                            <span><HiOutlinePhone /></span>
                            <div>
                                <strong>Phone</strong>
                                <p>+91 90000 00000</p>
                            </div>
                        </div>
                        <div className="contact-info__item">
                            <span><HiOutlineMapPin /></span>
                            <div>
                                <strong>Operations</strong>
                                <p>Municipal innovation hub, India</p>
                            </div>
                        </div>
                    </aside>

                    <div className="contact-form card">
                        <h3>Send Message</h3>
                        <p>We usually reply within one business day.</p>

                        {error && <div className="auth-error">{error}</div>}
                        {success && (
                            <div className="contact-success">
                                Message sent successfully. Our team will respond shortly.
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="contact-form__row">
                                <div className="input-group">
                                    <label htmlFor="name">Name</label>
                                    <input
                                        id="name"
                                        name="name"
                                        className="input"
                                        placeholder="Your full name"
                                        value={form.name}
                                        onChange={handleChange}
                                        minLength={2}
                                        maxLength={120}
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        className="input"
                                        placeholder="you@example.com"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label htmlFor="subject">Subject</label>
                                <input
                                    id="subject"
                                    name="subject"
                                    className="input"
                                    placeholder="Project inquiry"
                                    value={form.subject}
                                    onChange={handleChange}
                                    maxLength={160}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    className="input"
                                    rows={6}
                                    placeholder="Write your message"
                                    value={form.message}
                                    onChange={handleChange}
                                    minLength={10}
                                    maxLength={5000}
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Message'}
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
