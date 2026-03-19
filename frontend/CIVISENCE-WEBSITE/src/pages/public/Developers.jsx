import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import {
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineSparkles,
    HiOutlineUserCircle
} from 'react-icons/hi2';
import { FaGithub, FaGlobe, FaLinkedin } from 'react-icons/fa';
import PublicLayout from '../../components/Layout/PublicLayout';
import { getPublicDevelopers } from '../../api/public';
import { getErrorMessage } from '../../utils/helpers';
import './Developers.css';

const AUTO_ROTATE_MS = 7000;

const fallbackTeam = [
    {
        id: 'deepak',
        profileType: 'team',
        name: 'Deepak S',
        role: 'Team Lead - Cloud, Backend, Mobile App, Website',
        description:
            'Deepak leads the development and architecture of the CiviSense platform. He built the backend services, cloud infrastructure, and integrations between the mobile app and web platform to ensure a scalable civic reporting system.',
        photoUrl: null,
        skills: ['System Architecture', 'Backend APIs', 'Cloud Deployment', 'Mobile Integration'],
        highlights: ['Platform architecture leadership', 'Backend and cloud infrastructure'],
        socials: { github: '#', linkedin: '#', portfolio: '#' },
        isActive: true
    },
    {
        id: 'lokesh',
        profileType: 'team',
        name: 'Lokesh',
        role: 'Idea Architect - Research Lead',
        description:
            'Lokesh proposed the initial concept behind the CiviSense platform and researched real civic infrastructure problems to shape the direction of the project.',
        photoUrl: null,
        skills: [],
        highlights: ['Project ideation', 'Civic problem research'],
        socials: { github: '#', linkedin: '#', portfolio: '#' },
        isActive: true
    },
    {
        id: 'balavignesh',
        profileType: 'team',
        name: 'Bala Vignesh',
        role: 'Research Contributor',
        description:
            'Bala Vignesh supported the research phase of the CiviSense project by exploring the feasibility of AI-based civic issue detection and contributing to early project studies.',
        photoUrl: null,
        skills: [],
        highlights: ['AI research support', 'Project feasibility analysis'],
        socials: { github: '#', linkedin: '#', portfolio: '#' },
        isActive: true
    },
    {
        id: 'priyadharshini',
        profileType: 'team',
        name: 'Priya Dharshini',
        role: 'UI/UX Designer - Mobile App Design',
        description:
            'Priya Dharshini designed the user interface and user experience for the CiviSense mobile app and dashboards, focusing on simple and intuitive civic reporting flows.',
        photoUrl: null,
        skills: ['UI Design', 'UX Research', 'Mobile Interface Design'],
        highlights: ['Mobile app interface design', 'Citizen reporting UX'],
        socials: { github: '#', linkedin: '#', portfolio: '#' },
        isActive: true
    }
];

const fallbackMentor = {
    id: 'vijiyalakshmi',
    profileType: 'mentor',
    name: 'Mrs. Vijiyalakshmi',
    role: 'Assistant Professor - Project Guide',
    description:
        'Mrs. Vijiyalakshmi from Velammal Engineering College provided academic mentorship and guidance throughout the development of the CiviSense project.',
    photoUrl: null,
    highlights: ['Academic mentorship', 'Project supervision'],
    socials: { github: '#', linkedin: '#', portfolio: '#' }
};

const profileVariants = {
    enter: (direction) => ({
        opacity: 0,
        x: direction > 0 ? 36 : -36
    }),
    center: {
        opacity: 1,
        x: 0
    },
    exit: (direction) => ({
        opacity: 0,
        x: direction > 0 ? -36 : 36
    })
};

const toStringList = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    return [];
};

const normalizeProfile = (item, index = 0) => ({
    id: String(item?.id || item?._id || `dev-${index}`),
    profileType: String(item?.profileType || 'team').toLowerCase() === 'mentor' ? 'mentor' : 'team',
    name: String(item?.name || '').trim() || 'Unnamed Developer',
    role: String(item?.role || '').trim() || 'Developer',
    description: String(item?.description || '').trim() || 'Profile description will be updated soon.',
    photoUrl: String(item?.photoUrl || '').trim() || null,
    skills: toStringList(item?.skills),
    highlights: toStringList(item?.highlights),
    socials: {
        github: String(item?.socials?.github || '#').trim() || '#',
        linkedin: String(item?.socials?.linkedin || '#').trim() || '#',
        portfolio: String(item?.socials?.portfolio || '#').trim() || '#'
    },
    isActive: item?.isActive !== false,
    displayOrder: Number(item?.displayOrder || 0)
});

export default function Developers() {
    const [teamProfiles, setTeamProfiles] = useState([]);
    const [mentorProfile, setMentorProfile] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { scrollY } = useScroll();
    const heroDrift = useTransform(scrollY, [0, 800], [0, -120]);
    const orbDrift = useTransform(scrollY, [0, 900], [0, 160]);
    const orbRotate = useTransform(scrollY, [0, 900], [0, 6]);

    useEffect(() => {
        const loadProfiles = async () => {
            setLoading(true);
            setError('');

            try {
                const { data } = await getPublicDevelopers();
                const payload = data?.data || {};

                const rawProfiles = Array.isArray(payload.profiles)
                    ? payload.profiles
                    : [...(payload.team || []), ...(payload.mentor ? [payload.mentor] : [])];

                const normalizedProfiles = rawProfiles.map((item, index) => normalizeProfile(item, index));
                const nextTeam = normalizedProfiles
                    .filter((item) => item.profileType === 'team' && item.isActive)
                    .sort((a, b) => a.displayOrder - b.displayOrder);
                const nextMentor =
                    normalizedProfiles.find((item) => item.profileType === 'mentor' && item.isActive) || null;

                setTeamProfiles(nextTeam.length ? nextTeam : fallbackTeam);
                setMentorProfile(nextMentor || fallbackMentor);
            } catch (err) {
                setError(getErrorMessage(err));
                setTeamProfiles(fallbackTeam);
                setMentorProfile(fallbackMentor);
            } finally {
                setLoading(false);
            }
        };

        void loadProfiles();
    }, []);

    const hasMultipleProfiles = teamProfiles.length > 1;

    useEffect(() => {
        if (!teamProfiles.length) {
            setActiveIndex(0);
            return;
        }

        if (activeIndex > teamProfiles.length - 1) {
            setActiveIndex(0);
        }
    }, [teamProfiles, activeIndex]);

    useEffect(() => {
        if (!hasMultipleProfiles) return;

        const timerId = window.setInterval(() => {
            setDirection(1);
            setActiveIndex((prev) => (prev + 1) % teamProfiles.length);
        }, AUTO_ROTATE_MS);

        return () => window.clearInterval(timerId);
    }, [hasMultipleProfiles, teamProfiles.length]);

    const activeDeveloper = useMemo(() => {
        if (!teamProfiles.length) return fallbackTeam[0];
        return teamProfiles[activeIndex] || teamProfiles[0];
    }, [teamProfiles, activeIndex]);

    const goToNext = () => {
        if (!hasMultipleProfiles) return;
        setDirection(1);
        setActiveIndex((prev) => (prev + 1) % teamProfiles.length);
    };

    const goToPrev = () => {
        if (!hasMultipleProfiles) return;
        setDirection(-1);
        setActiveIndex((prev) => (prev - 1 + teamProfiles.length) % teamProfiles.length);
    };

    const goToIndex = (index) => {
        if (!hasMultipleProfiles || index === activeIndex) return;
        setDirection(index > activeIndex ? 1 : -1);
        setActiveIndex(index);
    };

    const renderSocialLink = (url, label, Icon) => {
        const disabled = !url || url === '#';

        return (
            <a
                href={disabled ? undefined : url}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-lg transition ${
                    disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-700'
                }`}
            >
                <Icon />
            </a>
        );
    };

    return (
        <PublicLayout>
            <div className="overflow-hidden">
                <motion.section
                    className="dev-hero py-14 lg:py-20"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.div
                        className="dev-hero__orbs"
                        style={{ y: heroDrift }}
                    >
                        <motion.span
                            className="dev-orb dev-orb--one"
                            style={{ y: orbDrift, rotate: orbRotate }}
                        />
                        <motion.span
                            className="dev-orb dev-orb--two"
                            style={{ y: orbDrift, rotate: orbRotate }}
                        />
                    </motion.div>
                    <div className="container space-y-6">
                        <span className="section-tag">
                            <HiOutlineSparkles />
                            CiviSense developer team
                        </span>
                        <h1 className="max-w-4xl text-balance text-5xl font-bold text-slate-950 sm:text-6xl">
                            The people shaping the product, research, and experience behind CiviSense.
                        </h1>
                        <p className="max-w-3xl text-lg leading-8 text-slate-600">
                            Engineers, researchers, and designers working together to build an AI-powered civic reporting
                            and municipal operations platform.
                        </p>
                        {loading ? (
                            <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700">
                                Loading developer profiles...
                            </div>
                        ) : null}
                        {!loading && error ? (
                            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
                                Showing fallback profile data: {error}
                            </div>
                        ) : null}
                    </div>
                    <motion.div
                        className="dev-scroll-cue"
                        animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        Scroll
                    </motion.div>
                </motion.section>

                <motion.section
                    className="pb-12"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="container">
                        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Interactive showcase</p>
                                <h2 className="mt-3 text-4xl font-bold text-slate-950">Meet the team one profile at a time</h2>
                            </div>
                            {hasMultipleProfiles ? (
                                <p className="text-sm text-slate-500">Auto-rotates every {AUTO_ROTATE_MS / 1000} seconds</p>
                            ) : null}
                        </div>

                        <motion.div
                            className="dev-panel rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.5)] lg:p-8"
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                            <AnimatePresence custom={direction} mode="wait">
                                <motion.article
                                    key={activeDeveloper.id}
                                    custom={direction}
                                    variants={profileVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                                    className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]"
                                >
                                    <div className="rounded-[2rem] bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(14,116,144,0.88))] p-6 text-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.8)]">
                                        <div className="flex h-full min-h-[300px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/10 p-6 backdrop-blur">
                                            {activeDeveloper.photoUrl ? (
                                                <img
                                                    src={activeDeveloper.photoUrl}
                                                    alt={activeDeveloper.name}
                                                    className="h-full max-h-[360px] w-full rounded-[1.5rem] object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-4 text-center">
                                                    <span className="text-7xl text-sky-200">
                                                        <HiOutlineUserCircle />
                                                    </span>
                                                    <div>
                                                        <p className="text-lg font-bold text-white">Photo will be updated soon</p>
                                                        <p className="mt-2 text-sm text-slate-200">{activeDeveloper.name}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">{activeDeveloper.role}</p>
                                            <h3 className="mt-3 text-4xl font-bold text-slate-950">{activeDeveloper.name}</h3>
                                            <p className="mt-4 text-base leading-8 text-slate-600">{activeDeveloper.description}</p>
                                        </div>

                                        {activeDeveloper.skills.length > 0 ? (
                                            <div>
                                                <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">Core skills</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {activeDeveloper.skills.map((skill) => (
                                                        <span
                                                            key={`${activeDeveloper.id}-${skill}`}
                                                            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}

                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">Highlights</p>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                {(activeDeveloper.highlights.length ? activeDeveloper.highlights : ['Highlights will be updated soon.']).map((highlight) => (
                                                    <div
                                                        key={`${activeDeveloper.id}-${highlight}`}
                                                        className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700"
                                                    >
                                                        {highlight}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3">
                                            {renderSocialLink(activeDeveloper.socials.github, `${activeDeveloper.name} GitHub`, FaGithub)}
                                            {renderSocialLink(activeDeveloper.socials.linkedin, `${activeDeveloper.name} LinkedIn`, FaLinkedin)}
                                            {renderSocialLink(activeDeveloper.socials.portfolio, `${activeDeveloper.name} Portfolio`, FaGlobe)}
                                        </div>
                                    </div>
                                </motion.article>
                            </AnimatePresence>

                            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={goToPrev}
                                        disabled={!hasMultipleProfiles}
                                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Previous developer"
                                    >
                                        <HiOutlineChevronLeft />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNext}
                                        disabled={!hasMultipleProfiles}
                                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Next developer"
                                    >
                                        <HiOutlineChevronRight />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {teamProfiles.map((developer, index) => (
                                        <button
                                            key={developer.id}
                                            type="button"
                                            onClick={() => goToIndex(index)}
                                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                                index === activeIndex
                                                    ? 'bg-slate-950 text-white'
                                                    : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
                                            }`}
                                            aria-label={`Show ${developer.name}`}
                                        >
                                            {developer.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </motion.section>

                <motion.section
                    className="py-12"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="container">
                        <div className="mb-8">
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-700">Contribution highlights</p>
                            <h2 className="mt-3 text-4xl font-bold text-slate-950">Team work areas</h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {teamProfiles.map((developer) => (
                                <motion.article
                                    key={`highlight-${developer.id}`}
                                    className="dev-card rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.45)]"
                                    whileHover={{ y: -6, scale: 1.02 }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                >
                                    <h3 className="text-2xl font-bold text-slate-950">{developer.name}</h3>
                                    <p className="mt-2 text-sm font-semibold text-sky-700">{developer.role}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {(developer.highlights.length ? developer.highlights : ['Highlights will be updated soon.']).map((highlight) => (
                                            <span
                                                key={`${developer.id}-${highlight}`}
                                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600"
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                    </div>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    className="pb-16 pt-12"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="container">
                        <motion.div
                            className="dev-mentor rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.9))] px-6 py-10 text-white shadow-[0_32px_100px_-44px_rgba(15,23,42,0.8)] lg:px-10"
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                            <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-200">Project guide / mentor</p>
                            <h2 className="mt-3 text-4xl font-bold text-white">{mentorProfile?.name || fallbackMentor.name}</h2>
                            <p className="mt-3 text-lg font-semibold text-cyan-100">{mentorProfile?.role || fallbackMentor.role}</p>
                            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
                                {mentorProfile?.description || fallbackMentor.description}
                            </p>
                        </motion.div>
                    </div>
                </motion.section>
            </div>
        </PublicLayout>
    );
}
