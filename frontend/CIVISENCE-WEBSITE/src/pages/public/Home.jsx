import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    HiOutlineArrowDownTray,
    HiOutlineArrowPath,
    HiOutlineBellAlert,
    HiOutlineBuildingOffice,
    HiOutlineChartBar,
    HiOutlineCheckCircle,
    HiOutlineCpuChip,
    HiOutlineMapPin,
    HiOutlineSparkles,
    HiOutlineUserGroup,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';
import { getAppConfig } from '../../api/public';

const workflow = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizens submit evidence',
        description: 'Photos, category details, and geolocation are captured in one quick reporting flow.'
    },
    {
        icon: HiOutlineCpuChip,
        title: 'AI scores urgency',
        description: 'The platform classifies complaints, flags likely duplicates, and estimates priority.'
    },
    {
        icon: HiOutlineArrowPath,
        title: 'Routing happens automatically',
        description: 'The issue is pushed toward the right municipal office based on category and location.'
    },
    {
        icon: HiOutlineCheckCircle,
        title: 'Resolution stays visible',
        description: 'Citizens and administrators can see progress instead of waiting in the dark.'
    }
];

const capabilities = [
    {
        icon: HiOutlineCpuChip,
        title: 'AI-assisted triage',
        description: 'Issue classification, priority reasoning, and routing support from the first submission.'
    },
    {
        icon: HiOutlineMapPin,
        title: 'Location-aware assignment',
        description: 'Complaints can be directed to the office or zone most likely to act fastest.'
    },
    {
        icon: HiOutlineBellAlert,
        title: 'Live operational updates',
        description: 'Notifications and dashboards keep citizens, officers, and admins aligned.'
    },
    {
        icon: HiOutlineChartBar,
        title: 'Performance analytics',
        description: 'Capacity, backlog, resolution, and trend views support better governance decisions.'
    }
];

const portalCards = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen portal',
        subtitle: 'Simple reporting and transparent tracking',
        points: ['Submit new civic issues', 'Watch status changes', 'See all complaint history']
    },
    {
        icon: HiOutlineWrenchScrewdriver,
        title: 'Officer portal',
        subtitle: 'Evidence review and action management',
        points: ['Review complaint details', 'Update status and remarks', 'Handle misuse reporting']
    },
    {
        icon: HiOutlineBuildingOffice,
        title: 'Admin portal',
        subtitle: 'System health, offices, zones, and analytics',
        points: ['Watch office capacity', 'Manage routing structure', 'Read citywide trends']
    }
];

const proofPoints = [
    { value: '3', label: 'connected user portals' },
    { value: '24/7', label: 'digital issue intake' },
    { value: 'AI', label: 'triage and priority assist' },
    { value: 'Live', label: 'status visibility' }
];

const sectionVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

const cardVariant = {
    hidden: { opacity: 0, y: 18 },
    visible: (index = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.32, delay: index * 0.06, ease: 'easeOut' }
    })
};

export default function Home() {
    const [appConfig, setAppConfig] = useState({
        androidApkUrl: ANDROID_APK_URL,
        iosNote: IOS_FUNNY_NOTE
    });

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
                <section className="relative">
                    <div className="container grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
                        <motion.div variants={sectionVariant} initial="hidden" animate="visible" className="space-y-8">
                            <span className="section-tag">
                                <HiOutlineSparkles />
                                Public complaint reporting system
                            </span>

                            <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                                        <CiviSenseLogo size={56} />
                                    </div>
                                    <div>
                                        <p className="font-display text-3xl font-bold text-slate-950 sm:text-4xl">CiviSense</p>
                                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                                            City issue reporting and tracking
                                        </p>
                                    </div>
                                </div>

                                <h1 className="max-w-3xl text-balance text-5xl font-bold text-slate-950 sm:text-6xl lg:text-7xl">
                                    Turn citizen complaints into clear, trackable municipal action.
                                </h1>
                                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                                    CiviSense helps cities collect civic complaints, score urgency with AI, route cases intelligently,
                                    and show every stakeholder what is happening next.
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
                                {proofPoints.map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]"
                                    >
                                        <p className="text-2xl font-extrabold text-slate-950">{item.value}</p>
                                        <p className="mt-1 text-sm text-slate-500">{item.label}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.08 }}
                            className="relative"
                        >
                            <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-sky-200/50 blur-3xl" />
                            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-teal-200/60 blur-3xl" />

                            <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(15,118,110,0.84))] p-5 text-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)]">
                                <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:72px_72px]" />
                                <div className="relative space-y-5">
                                    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">How it works</p>
                                            <h2 className="mt-1 text-2xl font-bold text-white">Complaint process</h2>
                                        </div>
                                        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                                            Active
                                        </span>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-3xl border border-white/12 bg-white/10 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">Citizen report example</p>
                                            <div className="mt-3 space-y-3">
                                                <div className="rounded-2xl bg-slate-950/30 p-4">
                                                    <p className="text-sm font-semibold text-white">Road pothole near bus stop</p>
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
                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Officer review</p>
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
                                                    <p className="text-xs text-slate-300">72% of available complaint capacity in use</p>
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
                            className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] lg:p-8"
                        >
                            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="max-w-2xl">
                                    <span className="section-tag">Mobile and web access</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">One complaint system for citizens and officers</h2>
                                    <p className="mt-4 text-base leading-8 text-slate-600">
                                        Citizens need speed and clarity. Officers need evidence and action tools. Administrators need the system view.
                                        CiviSense brings those together without forcing one workflow on everyone.
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
                                    <span className="section-tag">Complaint flow</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">How complaints are handled</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Designed for faster municipal handling and better public trust, from intake to closure.
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
                                    <span className="section-tag">Main features</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">What the website offers</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Strong information hierarchy, responsive layouts, and operational detail for every role.
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
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Separate views for each user role</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Each dashboard has a different job. The interface should respect that.
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
                                    <h2 className="mt-4 text-4xl font-bold text-white">Use CiviSense to report and track public issues.</h2>
                                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                                        CiviSense is designed to make issue reporting easier for citizens and response management clearer for authorities.
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
