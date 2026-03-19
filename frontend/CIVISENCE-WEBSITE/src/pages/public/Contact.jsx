import { useState } from 'react';
import { HiOutlineEnvelope, HiOutlineMapPin, HiOutlinePhone, HiOutlineSparkles } from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import { sendContactMessage } from '../../api/public';
import { getErrorMessage } from '../../utils/helpers';

const EMPTY_FORM = {
    name: '',
    email: '',
    subject: '',
    message: ''
};

const contactCards = [
    {
        icon: HiOutlineEnvelope,
        title: 'Email',
        value: 'support@civisense.com',
        note: 'Best for product support, deployment questions, and partnerships.'
    },
    {
        icon: HiOutlinePhone,
        title: 'Phone',
        value: '+91 90000 00000',
        note: 'Suitable for quick coordination and implementation discussions.'
    },
    {
        icon: HiOutlineMapPin,
        title: 'Operations',
        value: 'Municipal innovation hub, India',
        note: 'Project discussions, collaboration, and deployment planning.'
    }
];

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
            <div className="overflow-hidden">
                <section className="py-14 lg:py-20">
                    <div className="container grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
                        <div className="space-y-6">
                            <span className="section-tag">
                                <HiOutlineSparkles />
                                Contact the CiviSense team
                            </span>
                            <h1 className="max-w-3xl text-balance text-5xl font-bold text-slate-950 sm:text-6xl">
                                Talk to us about rollout, support, or collaboration.
                            </h1>
                            <p className="max-w-2xl text-lg leading-8 text-slate-600">
                                Use this page to reach the team behind the project. Whether you want deployment support,
                                a product walkthrough, or a partnership discussion, we can route your message to the right person.
                            </p>

                            <div className="grid gap-4">
                                {contactCards.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={item.title} className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                                            <div className="flex items-start gap-4">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">
                                                    <Icon />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{item.title}</p>
                                                    <h2 className="mt-1 text-xl font-bold text-slate-950">{item.value}</h2>
                                                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.note}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_26px_80px_-42px_rgba(15,23,42,0.5)] lg:p-8">
                            <div className="mb-6">
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Send a message</p>
                                <h2 className="mt-2 text-3xl font-bold text-slate-950">We usually respond within one business day.</h2>
                                <p className="mt-3 text-sm leading-7 text-slate-600">
                                    Share enough detail for us to understand your goal, current setup, and what kind of help you need.
                                </p>
                            </div>

                            {error ? <div className="auth-error">{error}</div> : null}
                            {success ? (
                                <div className="auth-info">
                                    Message sent successfully. The CiviSense team will get back to you shortly.
                                </div>
                            ) : null}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid gap-5 sm:grid-cols-2">
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

                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                                    Helpful context to include: deployment scope, city or organization type, current blockers, and whether you need support for citizen, officer, or admin workflows.
                                </div>

                                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                    {loading ? 'Sending...' : 'Send message'}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>
            </div>
        </PublicLayout>
    );
}
