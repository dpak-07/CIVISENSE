import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
    HiOutlineArrowDownTray,
    HiOutlineArrowPath,
    HiOutlineBellAlert,
    HiOutlineBuildingOffice,
    HiOutlineChartBar,
    HiOutlineCheckCircle,
    HiOutlineCpuChip,
    HiOutlineGlobeAlt,
    HiOutlineMapPin,
    HiOutlineSparkles,
    HiOutlineUserGroup,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import AnimatedCounter from '../../components/AnimatedCounter';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';
import { getAppConfig } from '../../api/public';

const impactMetrics = [
    {
        value: 3,
        suffix: '+',
        label: 'Role-based portals',
        description: 'Citizen, officer, and admin experiences designed for clarity.'
    },
    {
        value: 1,
        label: 'Shared complaint timeline',
        description: 'One lifecycle view across offices and public stakeholders.'
    },
    {
        value: 24,
        suffix: '/7',
        label: 'Always-on intake',
        description: 'Web and mobile reporting with continuous visibility.'
    },
    {
        value: 5,
        label: 'Workflow stages',
        description: 'Report, triage, assign, resolve, and verify with traceability.'
    }
];

const experienceHighlights = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen-first reporting',
        description: 'Quick evidence capture, transparent status timelines, and mobile-friendly updates.'
    },
    {
        icon: HiOutlineWrenchScrewdriver,
        title: 'Office execution tools',
        description: 'Clear queues, priority signals, and action buttons to move cases forward.'
    },
    {
        icon: HiOutlineBuildingOffice,
        title: 'City operations view',
        description: 'One place to watch backlog, capacity, and resolution performance.'
    }
];

const workflow = [
    {
        icon: HiOutlineUserGroup,
        title: 'Capture in minutes',
        description: 'Citizens submit issue details, photos, and location from any device.'
    },
    {
        icon: HiOutlineCpuChip,
        title: 'AI prioritizes quickly',
        description: 'Classification, duplicate checks, and urgency signals reduce manual sorting.'
    },
    {
        icon: HiOutlineArrowPath,
        title: 'Route to the right team',
        description: 'Complaints reach the correct office or zone with clear ownership.'
    },
    {
        icon: HiOutlineCheckCircle,
        title: 'Resolve with transparency',
        description: 'Every stakeholder sees status movement, notes, and outcomes.'
    }
];

const capabilities = [
    {
        icon: HiOutlineCpuChip,
        title: 'AI-assisted triage',
        description: 'Priority scoring, category suggestions, and routing insights from the first report.'
    },
    {
        icon: HiOutlineMapPin,
        title: 'Location-aware assignment',
        description: 'Complaints can be routed by zone, office jurisdiction, and field context.'
    },
    {
        icon: HiOutlineBellAlert,
        title: 'Live operational alerts',
        description: 'Notifications for delays, priority spikes, and workload thresholds.'
    },
    {
        icon: HiOutlineChartBar,
        title: 'Performance analytics',
        description: 'Track backlog trends, resolution speed, and office capacity health.'
    }
];

const portalCards = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen portal',
        subtitle: 'Report, track, and stay informed',
        points: ['Submit new civic issues', 'Track status and follow-up notes', 'Review your full complaint history']
    },
    {
        icon: HiOutlineWrenchScrewdriver,
        title: 'Officer portal',
        subtitle: 'Field-ready complaint execution',
        points: ['Review evidence and AI notes', 'Update status with remarks', 'Flag misuse and escalations']
    },
    {
        icon: HiOutlineBuildingOffice,
        title: 'Admin portal',
        subtitle: 'Citywide visibility and governance',
        points: ['Monitor office capacity', 'Manage zones and routing logic', 'Review analytics and trends']
    }
];

const readinessItems = [
    {
        icon: HiOutlineGlobeAlt,
        title: 'Multi-office coordination',
        description: 'Keep all departments aligned with one shared operational timeline.'
    },
    {
        icon: HiOutlineBellAlert,
        title: 'SLA-style escalation cues',
        description: 'Surface cases that are aging or stuck without response.'
    },
    {
        icon: HiOutlineChartBar,
        title: 'Operational reporting',
        description: 'Capture daily metrics, backlog health, and office responsiveness.'
    }
];

const sectionVariant = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const cardVariant = {
    hidden: { opacity: 0, y: 18 },
    visible: (index = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.34, delay: index * 0.06, ease: 'easeOut' }
    })
};

export default function Home() {
    const [appConfig, setAppConfig] = useState({
        androidApkUrl: ANDROID_APK_URL,
        iosNote: IOS_FUNNY_NOTE
    });
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroY = useTransform(scrollYProgress, [0, 1], [0, -120]);
    const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.04]);
    const orbShift = useTransform(scrollYProgress, [0, 1], [0, 60]);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const { data } = await getAppConfig();
                if (!data?.data) return;
                setAppConfig({
                    androidApkUrl: data.data.androidApkUrl || ANDROID_APK_URL,
                    iosNote: data.data.iosNote || IOS_FUNNY_NOTE
                });
            } catch {
                /* keep fallback content */
            }
        };

        void loadConfig();
    }, []);

    return (
        <PublicLayout>
            <div className="overflow-hidden">
                <section ref={heroRef} className="relative">
                    <motion.div
                        className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-sky-200/70 blur-3xl"
                        style={{ y: orbShift }}
                    />
                    <motion.div
                        className="absolute right-0 top-0 h-44 w-44 rounded-full bg-teal-200/70 blur-3xl"
                        style={{ y: orbShift }}
                    />
                    <div className="container grid gap-12 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-20">
                        <motion.div variants={sectionVariant} initial="hidden" animate="visible" className="space-y-8">
                            <span className="section-tag">
                                <HiOutlineSparkles />
                                Civic operations platform
                            </span>

                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                                        <CiviSenseLogo size={56} />
                                    </div>
                                    <div>
                                        <p className="font-display text-3xl font-bold text-slate-950 sm:text-4xl">CiviSense</p>
                                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                                            Citizen reporting and office action
                                        </p>
                                    </div>
                                </div>

                                <h1 className="max-w-3xl text-balance text-5xl font-bold text-slate-950 sm:text-6xl lg:text-7xl">
                                    Turn civic complaints into clear, accountable resolution.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                                    CiviSense is a unified platform for cities to capture public issues, prioritize them with AI,
                                    and keep citizens and offices aligned with live progress updates.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                <a
                                    href={appConfig.androidApkUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary btn-lg"
                                >
                                    <HiOutlineArrowDownTray />
                                    Download Android app
                                </a>
                                <Link to="/login" className="btn btn-secondary btn-lg">
                                    Open web portal
                                </Link>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {impactMetrics.map((item) => (
                                    <div key={item.label} className="metric-tile">
                                        <p className="text-3xl font-extrabold text-slate-950">
                                            <AnimatedCounter value={item.value} suffix={item.suffix || ''} />
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-700">{item.label}</p>
                                        <p className="mt-2 text-xs text-slate-500">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.08 }}
                            style={{ y: heroY, scale: heroScale }}
                            className="relative glow-ring"
                        >
                            <div className="relative overflow-hidden rounded-[2.2rem] border border-white/60 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(14,116,144,0.86))] p-6 text-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)]">
                                <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:80px_80px]" />
                                <div className="relative space-y-6">
                                    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Live operations</p>
                                            <h2 className="mt-1 text-2xl font-bold text-white">Complaint command view</h2>
                                        </div>
                                        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                                            Active
                                        </span>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">Citizen intake</p>
                                            <div className="mt-3 space-y-3">
                                                <div className="rounded-2xl bg-slate-950/30 p-4">
                                                    <p className="text-sm font-semibold text-white">Pothole near bus stop</p>
                                                    <p className="mt-2 text-xs text-slate-300">AI priority: High</p>
                                                </div>
                                                <div className="rounded-2xl bg-slate-950/30 p-4">
                                                    <p className="text-sm font-semibold text-white">Overflowing garbage point</p>
                                                    <p className="mt-2 text-xs text-slate-300">Status: Assigned to sanitary office</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Officer queue</p>
                                                <div className="mt-4 grid grid-cols-2 gap-3">
                                                    <div className="rounded-2xl bg-white/10 p-3">
                                                        <p className="text-2xl font-extrabold text-white">18</p>
                                                        <p className="text-xs text-slate-300">Assigned</p>
                                                    </div>
                                                    <div className="rounded-2xl bg-white/10 p-3">
                                                        <p className="text-2xl font-extrabold text-white">7</p>
                                                        <p className="text-xs text-slate-300">In progress</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">Admin monitoring</p>
                                                <div className="mt-4 space-y-3">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-300">Top load office</span>
                                                        <span className="font-bold text-white">North Zone Ops</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-white/15">
                                                        <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-sky-300 to-emerald-300" />
                                                    </div>
                                                    <p className="text-xs text-slate-300">72% of available capacity in use</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-white/12 bg-white/10 px-4 py-3 text-sm text-slate-200">
                                        iOS note: {appConfig.iosNote}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-8">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.25 }}
                            className="section-shell p-6 lg:p-8"
                        >
                            <div className="section-shell__content flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="max-w-2xl">
                                    <span className="section-tag">Mobile and web access</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">
                                        One system for citizens, officers, and city leaders.
                                    </h2>
                                    <p className="mt-4 text-base leading-8 text-slate-600">
                                        CiviSense combines citizen reporting, officer action tools, and administrative oversight in one secure interface.
                                        Everyone stays on the same timeline without losing context between departments.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:min-w-[22rem]">
                                    <a
                                        href={appConfig.androidApkUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary"
                                    >
                                        <HiOutlineArrowDownTray />
                                        Download the Android app
                                    </a>
                                    <Link to="/register" className="btn btn-secondary">
                                        Create a citizen account
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container">
                        <motion.div variants={sectionVariant} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                            <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <span className="section-tag">Experience design</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Built around every role in the chain.</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Citizen transparency, officer execution, and admin oversight are treated as first-class experiences.
                                </p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                {experienceHighlights.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <motion.article
                                            key={item.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                                        >
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{item.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container">
                        <motion.div variants={sectionVariant} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                            <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <span className="section-tag">Complaint flow</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">How complaints move from report to action</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Designed for faster municipal handling and more public trust, from intake to closure.
                                </p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-4">
                                {workflow.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <motion.article
                                            key={item.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                                        >
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{item.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container">
                        <motion.div variants={sectionVariant} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                            <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <span className="section-tag">Operational strengths</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Built for municipal performance</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    A production-ready toolkit that improves response time, visibility, and accountability.
                                </p>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {capabilities.map((feature, index) => {
                                    const Icon = feature.icon;
                                    return (
                                        <motion.article
                                            key={feature.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                                        >
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-700">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{feature.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container">
                        <motion.div variants={sectionVariant} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}>
                            <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div>
                                    <span className="section-tag">User portals</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Dedicated dashboards for every role</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Each portal is tuned for its users and the decisions they need to make.
                                </p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                {portalCards.map((portal, index) => {
                                    const Icon = portal.icon;
                                    return (
                                        <motion.article
                                            key={portal.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                                        >
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-800">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{portal.title}</h3>
                                            <p className="mt-2 text-sm font-semibold text-sky-700">{portal.subtitle}</p>
                                            <ul className="mt-5 space-y-3">
                                                {portal.points.map((point) => (
                                                    <li key={point} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
                                                        <span className="mt-2 h-2 w-2 rounded-full bg-sky-500" />
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="py-12">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                            className="section-shell p-6 lg:p-8"
                        >
                            <div className="section-shell__content grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                                <div>
                                    <span className="section-tag">Operations readiness</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Purpose-built for office coordination</h2>
                                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                                        Roll out CiviSense as the operating system for city complaint response. Monitor intake,
                                        manage workload, and keep citizens in the loop without losing context.
                                    </p>
                                </div>
                                <div className="grid gap-3">
                                    {readinessItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={item.title}
                                                className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-xl text-sky-700">
                                                        <Icon />
                                                    </span>
                                                    <div>
                                                        <p className="text-base font-semibold text-slate-950">{item.title}</p>
                                                        <p className="text-sm text-slate-600">{item.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="pb-16 pt-12">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.3 }}
                            className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] px-6 py-10 text-white shadow-[0_32px_100px_-44px_rgba(15,23,42,0.8)] lg:px-10"
                        >
                            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="max-w-3xl">
                                    <span className="section-tag border-white/20 bg-white/10 text-sky-100">Get started</span>
                                    <h2 className="mt-4 text-4xl font-bold text-white">
                                        Launch a citizen-friendly reporting platform in your city.
                                    </h2>
                                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                                        CiviSense is ready for production rollouts, from pilot deployment to multi-office operations.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <a
                                        href={appConfig.androidApkUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary btn-lg"
                                    >
                                        <HiOutlineArrowDownTray />
                                        Download app
                                    </a>
                                    <Link to="/about" className="btn btn-secondary btn-lg">
                                        Learn more
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </PublicLayout>
    );
}
