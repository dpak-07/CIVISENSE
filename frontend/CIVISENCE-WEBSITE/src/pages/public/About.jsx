import { motion } from 'framer-motion';
import {
    HiOutlineArrowPath,
    HiOutlineBuildingOffice,
    HiOutlineChartBar,
    HiOutlineCpuChip,
    HiOutlineMapPin,
    HiOutlineShieldCheck,
    HiOutlineSparkles,
    HiOutlineUserGroup,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';

const governanceLayers = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen experience',
        description: 'Simple reporting, complaint history, and transparent updates instead of opaque follow-up.'
    },
    {
        icon: HiOutlineWrenchScrewdriver,
        title: 'Officer workflow',
        description: 'Complaint review, evidence handling, status updates, and action monitoring in one place.'
    },
    {
        icon: HiOutlineBuildingOffice,
        title: 'Admin oversight',
        description: 'Office capacity, zone management, analytics, and governance visibility for city operations.'
    }
];

const operatingModel = [
    {
        icon: HiOutlineMapPin,
        title: 'Intake with context',
        description: 'Every report can include issue details, photo evidence, and coordinates.'
    },
    {
        icon: HiOutlineCpuChip,
        title: 'AI interpretation',
        description: 'Classification, duplicate detection, and urgency support help reduce manual sorting.'
    },
    {
        icon: HiOutlineArrowPath,
        title: 'Routing and action',
        description: 'Complaints can be directed into the right queue or office workflow faster.'
    },
    {
        icon: HiOutlineChartBar,
        title: 'Monitoring and learning',
        description: 'Leaders can watch backlog, capacity, and trend patterns across the system.'
    }
];

const principles = [
    'Transparent updates for citizens and administrators',
    'Role-based tools that match real municipal work',
    'Analytics that support planning, not just reporting',
    'A responsive interface that works across devices'
];

const sectionVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

export default function About() {
    return (
        <PublicLayout>
            <div className="overflow-hidden">
                <section className="py-14 lg:py-20">
                    <div className="container grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                        <motion.div variants={sectionVariant} initial="hidden" animate="visible" className="space-y-6">
                            <span className="section-tag">
                                <HiOutlineSparkles />
                                About CiviSense
                            </span>
                            <h1 className="max-w-3xl text-balance text-5xl font-bold text-slate-950 sm:text-6xl">
                                A civic intelligence platform designed for real city operations.
                            </h1>
                            <p className="max-w-2xl text-lg leading-8 text-slate-600">
                                CiviSense exists to close the gap between citizen issue reporting and municipal action.
                                Instead of disconnected forms, unclear routing, and hidden progress, the platform brings a shared operating picture to everyone involved.
                            </p>
                            <p className="max-w-2xl text-base leading-8 text-slate-600">
                                The web experience supports citizen tracking, officer workflows, and administrative oversight, while the mobile app helps collect issue evidence quickly in the field.
                            </p>
                        </motion.div>

                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.08 }}
                            className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_26px_80px_-42px_rgba(15,23,42,0.5)]"
                        >
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Why it matters</p>
                            <div className="mt-5 space-y-4">
                                <div className="rounded-3xl bg-slate-50 p-5">
                                    <h2 className="text-2xl font-bold text-slate-950">Less manual coordination</h2>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">
                                        AI-assisted classification and routing reduce the first layer of operational delay.
                                    </p>
                                </div>
                                <div className="rounded-3xl bg-slate-50 p-5">
                                    <h2 className="text-2xl font-bold text-slate-950">Better public trust</h2>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">
                                        Citizens can see status movement instead of wondering whether a complaint disappeared.
                                    </p>
                                </div>
                                <div className="rounded-3xl bg-slate-50 p-5">
                                    <h2 className="text-2xl font-bold text-slate-950">Stronger management insight</h2>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">
                                        Administrators get clearer visibility into office capacity, backlog, and performance patterns.
                                    </p>
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
                                    <span className="section-tag">Connected layers</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">Three user portals, one shared system</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    Good civic software should adapt to different users without fragmenting the data model.
                                </p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-3">
                                {governanceLayers.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <article key={item.title} className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-800">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{item.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                                        </article>
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
                                    <span className="section-tag">Operating model</span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">How complaints flow through CiviSense</h2>
                                </div>
                                <p className="max-w-2xl text-base leading-7 text-slate-600">
                                    The platform is designed to move information forward without losing context along the way.
                                </p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-4">
                                {operatingModel.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <article key={item.title} className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-700">
                                                <Icon />
                                            </div>
                                            <h3 className="mt-5 text-2xl font-bold text-slate-950">{item.title}</h3>
                                            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                                        </article>
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
                            className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,246,255,0.95))] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] lg:p-8"
                        >
                            <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
                                <div>
                                    <span className="section-tag">
                                        <HiOutlineShieldCheck />
                                        Design principles
                                    </span>
                                    <h2 className="mt-4 text-4xl font-bold text-slate-950">The product values behind the interface</h2>
                                    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                                        CiviSense is built around visibility, responsibility, and usability. The system should not feel like a collection of screens; it should feel like a clear operational tool.
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {principles.map((item) => (
                                        <div key={item} className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </PublicLayout>
    );
}
