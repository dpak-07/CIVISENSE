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
    HiOutlineUserGroup,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';
import { getAppConfig } from '../../api/public';
import './Home.css';

const howItWorks = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen reports issue',
        description: 'Citizens submit photos, location, and issue details in seconds.'
    },
    {
        icon: HiOutlineCpuChip,
        title: 'AI analyzes complaint',
        description: 'The platform classifies category and checks for similar reports.'
    },
    {
        icon: HiOutlineArrowPath,
        title: 'System routes issue',
        description: 'The report is assigned to the right municipal department automatically.'
    },
    {
        icon: HiOutlineCheckCircle,
        title: 'Authority resolves problem',
        description: 'Officials update progress and close cases with transparent status.'
    }
];

const features = [
    {
        icon: HiOutlineCpuChip,
        title: 'AI Issue Detection',
        description: 'Classifies complaints and improves triage quality from submission.'
    },
    {
        icon: HiOutlineMapPin,
        title: 'Geo Location Routing',
        description: 'Routes reports to the nearest responsible office by location.'
    },
    {
        icon: HiOutlineBellAlert,
        title: 'Live Complaint Tracking',
        description: 'Citizens and officers get real-time status updates during resolution.'
    },
    {
        icon: HiOutlineChartBar,
        title: 'Governance Analytics',
        description: 'Tracks response trends, backlog, and city-level issue distribution.'
    }
];

const portals = [
    {
        icon: HiOutlineUserGroup,
        title: 'Citizen Portal',
        points: ['Quick issue reporting', 'Track complaint status', 'View profile report history']
    },
    {
        icon: HiOutlineWrenchScrewdriver,
        title: 'Sub Office Portal',
        points: ['Assigned complaint queue', 'Priority-based actions', 'Resolution workflow updates']
    },
    {
        icon: HiOutlineBuildingOffice,
        title: 'Admin Control Center',
        points: ['Office and zone management', 'Platform analytics overview', 'Governance configuration']
    }
];

const sectionVariant = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

const cardVariant = {
    hidden: { opacity: 0, y: 14 },
    visible: (index = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.32, delay: index * 0.05, ease: 'easeOut' }
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
                // Keep fallback constants.
            }
        };

        void loadConfig();
    }, []);

    return (
        <PublicLayout>
            <div className="home-page">
                <section className="home-page__hero">
                    <div className="home-page__orb home-page__orb--left" />
                    <div className="home-page__orb home-page__orb--right" />

                    <div className="container">
                        <div className="home-page__hero-grid">
                            <motion.div
                                variants={sectionVariant}
                                initial="hidden"
                                animate="visible"
                                className="home-page__hero-content"
                            >
                                <span className="home-page__eyebrow">Civic Technology Platform</span>

                                <div className="home-page__brand">
                                    <CiviSenseLogo size={46} />
                                    <h1>CiviSense</h1>
                                </div>

                                <p className="home-page__tagline">Making Cities Better, Together</p>

                                <p className="home-page__description">
                                    CiviSense helps citizens report potholes, garbage overflow, water leaks, drainage
                                    blockages, and traffic problems. AI categorizes each complaint and routes it to the
                                    right municipal department for faster resolution.
                                </p>

                                <div className="home-page__actions">
                                    <a href={appConfig.androidApkUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                                        <HiOutlineArrowDownTray />
                                        Download Android App
                                    </a>
                                    <Link to="/about" className="btn btn-secondary">
                                        Explore Platform
                                    </Link>
                                </div>
                            </motion.div>

                            <motion.div
                                variants={sectionVariant}
                                initial="hidden"
                                animate="visible"
                                transition={{ delay: 0.06, duration: 0.45 }}
                                className="home-page__mockup-wrap"
                            >
                                <div className="home-page__mockup-shell">
                                    <div className="home-page__mockup-body">
                                        <div className="home-page__mockup-notch" />

                                        <div className="home-page__mockup-card">
                                            <p className="home-page__mockup-label">New Complaint</p>
                                            <p className="home-page__mockup-title">Road pothole near bus stop</p>
                                            <p className="home-page__mockup-meta">AI: High priority</p>
                                        </div>

                                        <div className="home-page__mockup-card">
                                            <p className="home-page__mockup-label">Status Tracking</p>
                                            <p className="home-page__mockup-title">Assigned to Zone Office</p>
                                            <p className="home-page__mockup-meta">Updated 2 mins ago</p>
                                        </div>

                                        <div className="home-page__mockup-placeholder" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                <section id="app-download" className="home-page__section home-page__section--soft">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.25 }}
                            className="home-page__promo-grid"
                        >
                            <div className="home-page__promo-content">
                                <h2>Report civic issues instantly from your phone</h2>
                                <p>
                                    Capture the issue, attach location, and submit. CiviSense keeps citizens informed as
                                    complaints move through municipal workflows.
                                </p>
                                <div className="home-page__actions">
                                    <a href={appConfig.androidApkUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                                        <HiOutlineArrowDownTray />
                                        Download App
                                    </a>
                                    <Link to="/login" className="btn btn-secondary">
                                        Open Web Portal
                                    </Link>
                                </div>
                                <p className="home-page__ios-note">{appConfig.iosNote}</p>
                            </div>

                            <div className="home-page__promo-panel">
                                <p className="home-page__panel-label">Mobile Preview</p>
                                <div className="home-page__panel-list">
                                    <article>
                                        <p>Upload issue image</p>
                                        <span>Add photo and description</span>
                                    </article>
                                    <article>
                                        <p>Pin location</p>
                                        <span>Auto route to nearby office</span>
                                    </article>
                                    <article>
                                        <p>Track progress</p>
                                        <span>Get status updates in real time</span>
                                    </article>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="home-page__section">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                        >
                            <div className="home-page__section-header">
                                <h2>How It Works</h2>
                            </div>
                            <div className="home-page__grid home-page__grid--four">
                                {howItWorks.map((step, index) => {
                                    const Icon = step.icon;

                                    return (
                                        <motion.article
                                            key={step.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="home-page__card"
                                        >
                                            <div className="home-page__icon-box">
                                                <Icon />
                                            </div>
                                            <h3>{step.title}</h3>
                                            <p>{step.description}</p>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="home-page__section home-page__section--soft">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                        >
                            <div className="home-page__section-header">
                                <h2>Platform Features</h2>
                            </div>
                            <div className="home-page__grid home-page__grid--four">
                                {features.map((feature, index) => {
                                    const Icon = feature.icon;

                                    return (
                                        <motion.article
                                            key={feature.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="home-page__card"
                                        >
                                            <div className="home-page__icon-box home-page__icon-box--cyan">
                                                <Icon />
                                            </div>
                                            <h3>{feature.title}</h3>
                                            <p>{feature.description}</p>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="home-page__section">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                        >
                            <div className="home-page__section-header">
                                <h2>Role Portals</h2>
                            </div>
                            <div className="home-page__grid home-page__grid--three">
                                {portals.map((portal, index) => {
                                    const Icon = portal.icon;

                                    return (
                                        <motion.article
                                            key={portal.title}
                                            custom={index}
                                            variants={cardVariant}
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{ once: true, amount: 0.2 }}
                                            className="home-page__card"
                                        >
                                            <div className="home-page__icon-box home-page__icon-box--slate">
                                                <Icon />
                                            </div>
                                            <h3>{portal.title}</h3>
                                            <ul className="home-page__list">
                                                {portal.points.map((point) => (
                                                    <li key={point}>{point}</li>
                                                ))}
                                            </ul>
                                        </motion.article>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                </section>

                <section className="home-page__section">
                    <div className="container">
                        <motion.div
                            variants={sectionVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.3 }}
                            className="home-page__cta"
                        >
                            <h2>Build smarter cities with CiviSense</h2>
                            <p>CiviSense is building smarter cities through technology and citizen participation.</p>
                            <div className="home-page__actions home-page__actions--center">
                                <a href={appConfig.androidApkUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                                    <HiOutlineArrowDownTray />
                                    Download App
                                </a>
                                <Link to="/about" className="btn btn-secondary">
                                    Learn More
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </PublicLayout>
    );
}
