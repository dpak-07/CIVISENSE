import { useEffect, useState } from 'react';
import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import './Developers.css';

const ROTATE_MS = 5600;
const OUT_MS = 420;
const IN_MS = 360;

const developers = [
    {
        name: 'Deepak Kumar',
        role: 'Lead Full Stack Engineer',
        photo: 'https://i.pravatar.cc/480?img=12',
        description:
            'Deepak designed the full technical backbone of CiviSense. He built the role-based architecture that connects citizen, sub-office, and admin flows in one coherent system.',
        work: [
            'Designed the core API structure and authentication lifecycle',
            'Implemented multi-role routing between citizen, officer, and admin portals',
            'Integrated release-ready website + backend workflow',
            'Aligned product behavior with real civic complaint operations'
        ],
        badges: ['Architecture', 'Integration', 'DevOps']
    },
    {
        name: 'Ananya R',
        role: 'Frontend Experience Engineer',
        photo: 'https://i.pravatar.cc/480?img=47',
        description:
            'Ananya transformed functional pages into a polished civic interface with clear hierarchy, transitions, and consistent responsive behavior.',
        work: [
            'Crafted landing, about, contact, and developers experiences',
            'Implemented motion language and transition consistency',
            'Improved responsive behavior for mobile and desktop',
            'Built reusable visual styles for speed and consistency'
        ],
        badges: ['UI Systems', 'Motion', 'Responsive']
    },
    {
        name: 'Karthik S',
        role: 'AI Systems Engineer',
        photo: 'https://i.pravatar.cc/480?img=33',
        description:
            'Karthik engineered the AI support layer used for complaint intelligence, duplicate detection, and practical priority scoring.',
        work: [
            'Built complaint priority and signal scoring logic',
            'Added duplicate detection hooks for repeated reports',
            'Defined AI integration interfaces for backend services',
            'Focused on production-safe AI behavior and fallback paths'
        ],
        badges: ['AI Logic', 'Scoring', 'Reliability']
    },
    {
        name: 'Mira N',
        role: 'Backend Reliability Engineer',
        photo: 'https://i.pravatar.cc/480?img=5',
        description:
            'Mira hardened reliability so CiviSense remains stable under real civic usage with robust validation, error handling, and service consistency.',
        work: [
            'Improved backend stability and guardrails for failures',
            'Strengthened secure service boundaries and validation paths',
            'Refined monitoring and operational readiness practices',
            'Supported resilient rollout and maintainability improvements'
        ],
        badges: ['Reliability', 'Security', 'Maintainability']
    }
];

export default function Developers() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [phase, setPhase] = useState('in');
    const [paused, setPaused] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [progressKey, setProgressKey] = useState(0);

    const runTransition = (nextIndex) => {
        if (transitioning || nextIndex === activeIndex) return;
        setTransitioning(true);
        setPhase('out');

        window.setTimeout(() => {
            setActiveIndex(nextIndex);
            setPhase('glitch-in');
            setProgressKey((prev) => prev + 1);

            window.setTimeout(() => {
                setPhase('in');
                setTransitioning(false);
            }, IN_MS);
        }, OUT_MS);
    };

    const goPrev = () => runTransition((activeIndex - 1 + developers.length) % developers.length);
    const goNext = () => runTransition((activeIndex + 1) % developers.length);

    useEffect(() => {
        if (paused || transitioning) return undefined;
        const timerId = window.setTimeout(() => {
            goNext();
        }, ROTATE_MS);
        return () => window.clearTimeout(timerId);
    }, [activeIndex, paused, transitioning]);

    const member = developers[activeIndex];

    return (
        <PublicLayout>
            <section className="dev-page__hero">
                <div className="dev-page__ambient" aria-hidden="true">
                    <span className="dev-page__ambient-orb dev-page__ambient-orb--a" />
                    <span className="dev-page__ambient-orb dev-page__ambient-orb--b" />
                    <span className="dev-page__ambient-grid" />
                </div>

                <div className="container">
                    <div className="dev-page__hero-brand">
                        <CiviSenseLogo size={58} className="dev-page__hero-logo" />
                        <span className="section-tag">Developer Team</span>
                    </div>
                    <h1>Meet the builders of CiviSense.</h1>
                    <p>
                        Cinematic rotating profile showcase with glitch transitions, feature highlights,
                        and manual controls for each core team member.
                    </p>
                </div>
            </section>

            <section className="dev-page__showcase">
                <div className="container">
                    <article
                        className={`dev-profile-card card ${phase}`}
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                    >
                        <div key={`p-${progressKey}`} className="dev-profile-card__progress" aria-hidden="true" />

                        <div className="dev-profile-card__photo-wrap">
                            <img src={member.photo} alt={member.name} className="dev-profile-card__photo" loading="lazy" />
                            <span className="dev-profile-card__scan" aria-hidden="true" />
                            <span className="dev-profile-card__glitch" aria-hidden="true" />
                        </div>

                        <div className="dev-profile-card__content">
                            <h2>{member.name}</h2>
                            <strong>{member.role}</strong>
                            <p>{member.description}</p>

                            <div className="dev-profile-card__badges">
                                {member.badges.map((badge) => (
                                    <span key={badge}>{badge}</span>
                                ))}
                            </div>

                            <h4>What they built</h4>
                            <ul>
                                {member.work.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </article>

                    <div className="dev-controls">
                        <button type="button" className="dev-controls__btn" onClick={goPrev} aria-label="Previous developer">
                            <HiOutlineChevronLeft />
                        </button>
                        <div className="dev-controls__dots">
                            {developers.map((item, index) => (
                                <button
                                    key={item.name}
                                    type="button"
                                    className={`dev-controls__dot ${activeIndex === index ? 'active' : ''}`}
                                    onClick={() => runTransition(index)}
                                    aria-label={`Show ${item.name}`}
                                >
                                    <span>{item.name}</span>
                                </button>
                            ))}
                        </div>
                        <button type="button" className="dev-controls__btn" onClick={goNext} aria-label="Next developer">
                            <HiOutlineChevronRight />
                        </button>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
