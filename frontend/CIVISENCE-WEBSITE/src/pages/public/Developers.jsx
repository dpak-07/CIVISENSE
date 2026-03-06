import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
        x: direction > 0 ? 32 : -32
    }),
    center: {
        opacity: 1,
        x: 0
    },
    exit: (direction) => ({
        opacity: 0,
        x: direction > 0 ? -32 : 32
    })
};

const sectionVariant = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } }
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
                className={`dev-page__social ${disabled ? 'dev-page__social--disabled' : ''}`}
            >
                <Icon />
            </a>
        );
    };

    return (
        <PublicLayout>
            <div className="dev-page">
                <section className="dev-page__hero">
                    <div className="dev-page__orb dev-page__orb--left" />
                    <div className="dev-page__orb dev-page__orb--right" />

                    <div className="container">
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="dev-page__hero-inner"
                        >
                            <span className="section-tag">
                                <HiOutlineSparkles />
                                CiviSense Developer Team
                            </span>
                            <h1>The Team Behind CiviSense</h1>
                            <p>
                                Engineers, researchers, and designers working together to build an AI-powered civic
                                intelligence platform for transparent and faster issue resolution.
                            </p>
                            {loading ? <p className="dev-page__status">Loading developer profiles...</p> : null}
                            {!loading && error ? (
                                <p className="dev-page__status dev-page__status--warn">Showing fallback profile data: {error}</p>
                            ) : null}
                        </motion.div>
                    </div>
                </section>

                <section className="dev-page__showcase">
                    <div className="container">
                        <div className="dev-page__heading-row">
                            <div>
                                <p className="dev-page__eyebrow">Interactive Team Showcase</p>
                                <h2>One Developer Card at a Time</h2>
                            </div>
                            {hasMultipleProfiles ? (
                                <p className="dev-page__rotate-note">
                                    Auto-rotates every {AUTO_ROTATE_MS / 1000} seconds
                                </p>
                            ) : null}
                        </div>

                        <div className="dev-page__profile-shell">
                            <AnimatePresence custom={direction} mode="wait">
                                <motion.article
                                    key={activeDeveloper.id}
                                    custom={direction}
                                    variants={profileVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                                    className="dev-page__profile"
                                >
                                    <div className="dev-page__photo-panel">
                                        <div className="dev-page__photo-frame">
                                            {activeDeveloper.photoUrl ? (
                                                <img
                                                    src={activeDeveloper.photoUrl}
                                                    alt={activeDeveloper.name}
                                                    className="dev-page__photo"
                                                />
                                            ) : (
                                                <div className="dev-page__photo-empty">
                                                    <span className="dev-page__photo-icon">
                                                        <HiOutlineUserCircle />
                                                    </span>
                                                    <p>Photo will be updated soon</p>
                                                    <small>{activeDeveloper.name}</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="dev-page__content">
                                        <p className="dev-page__role">{activeDeveloper.role}</p>
                                        <h3>{activeDeveloper.name}</h3>
                                        <p className="dev-page__description">{activeDeveloper.description}</p>

                                        {activeDeveloper.skills.length > 0 ? (
                                            <div className="dev-page__skills">
                                                {activeDeveloper.skills.map((skill) => (
                                                    <span key={`${activeDeveloper.id}-${skill}`}>{skill}</span>
                                                ))}
                                            </div>
                                        ) : null}

                                        <div className="dev-page__socials">
                                            {renderSocialLink(
                                                activeDeveloper.socials.github,
                                                `${activeDeveloper.name} GitHub`,
                                                FaGithub
                                            )}
                                            {renderSocialLink(
                                                activeDeveloper.socials.linkedin,
                                                `${activeDeveloper.name} LinkedIn`,
                                                FaLinkedin
                                            )}
                                            {renderSocialLink(
                                                activeDeveloper.socials.portfolio,
                                                `${activeDeveloper.name} Portfolio`,
                                                FaGlobe
                                            )}
                                        </div>
                                    </div>
                                </motion.article>
                            </AnimatePresence>
                        </div>

                        <div className="dev-page__controls">
                            <button
                                type="button"
                                onClick={goToPrev}
                                disabled={!hasMultipleProfiles}
                                className="dev-page__nav-btn"
                                aria-label="Previous developer"
                            >
                                <HiOutlineChevronLeft />
                            </button>

                            <div className="dev-page__dots">
                                {teamProfiles.map((developer, index) => (
                                    <button
                                        key={developer.id}
                                        type="button"
                                        onClick={() => goToIndex(index)}
                                        className={`dev-page__dot ${index === activeIndex ? 'active' : ''}`}
                                        aria-label={`Show ${developer.name}`}
                                    >
                                        {developer.name}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={goToNext}
                                disabled={!hasMultipleProfiles}
                                className="dev-page__nav-btn"
                                aria-label="Next developer"
                            >
                                <HiOutlineChevronRight />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="dev-page__highlights">
                    <div className="container">
                        <div className="section-header">
                            <span className="section-tag">Contribution Highlights</span>
                            <h2>Team Work Areas</h2>
                        </div>

                        <div className="dev-page__highlight-grid">
                            {teamProfiles.map((developer, developerIndex) => (
                                <motion.article
                                    key={`highlight-${developer.id}`}
                                    variants={sectionVariant}
                                    initial="hidden"
                                    whileInView="visible"
                                    viewport={{ once: true, amount: 0.25 }}
                                    transition={{ delay: developerIndex * 0.05 }}
                                    className="dev-page__highlight-card"
                                >
                                    <h3>{developer.name}</h3>
                                    <p className="dev-page__highlight-role">{developer.role}</p>
                                    <div className="dev-page__highlight-tags">
                                        {developer.highlights.length > 0 ? (
                                            developer.highlights.map((highlight) => (
                                                <span key={`${developer.id}-${highlight}`}>{highlight}</span>
                                            ))
                                        ) : (
                                            <span>Highlights will be updated soon.</span>
                                        )}
                                    </div>
                                </motion.article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="dev-page__mentor">
                    <div className="container">
                        <motion.article
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.3 }}
                            className="dev-page__mentor-card"
                        >
                            <p className="dev-page__eyebrow">Project Guide / Mentor</p>
                            <h2>{mentorProfile?.name || fallbackMentor.name}</h2>
                            <p className="dev-page__mentor-role">{mentorProfile?.role || fallbackMentor.role}</p>
                            <p className="dev-page__mentor-desc">{mentorProfile?.description || fallbackMentor.description}</p>
                        </motion.article>
                    </div>
                </section>
            </div>
        </PublicLayout>
    );
}
