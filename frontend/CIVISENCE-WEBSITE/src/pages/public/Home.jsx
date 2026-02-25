import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    HiOutlineArrowDownTray,
    HiOutlineBellAlert,
    HiOutlineChartBar,
    HiOutlineCpuChip,
    HiOutlineMapPin,
    HiOutlineShieldCheck,
    HiOutlineSparkles,
    HiOutlineUserGroup,
    HiOutlineBuildingOffice,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import PublicLayout from '../../components/Layout/PublicLayout';
import CiviSenseLogo from '../../components/branding/CiviSenseLogo';
import { ANDROID_APK_URL, IOS_FUNNY_NOTE } from '../../constants/appLinks';
import { getAppConfig } from '../../api/public';
import './Home.css';

const platformFeatures = [
    {
        icon: <HiOutlineCpuChip />,
        title: 'AI Issue Intelligence',
        desc: 'Automatic categorization, duplicate detection, and priority scoring for every report.'
    },
    {
        icon: <HiOutlineMapPin />,
        title: 'Geo Routing Engine',
        desc: 'Issues are routed to the nearest capable office using ward-level geospatial mapping.'
    },
    {
        icon: <HiOutlineBellAlert />,
        title: 'Live Status Stream',
        desc: 'Citizens and offices receive instant complaint progress updates across the workflow.'
    },
    {
        icon: <HiOutlineChartBar />,
        title: 'Governance Analytics',
        desc: 'Admin dashboards track resolution rates, office load, and category trends in real time.'
    },
    {
        icon: <HiOutlineShieldCheck />,
        title: 'Role Security',
        desc: 'Portal access is controlled by secure role-based authentication for every user type.'
    },
    {
        icon: <HiOutlineSparkles />,
        title: 'Production Workflow',
        desc: 'From citizen report to closure audit trail, everything runs in one connected system.'
    }
];

const rolePortals = [
    {
        icon: <HiOutlineUserGroup />,
        title: 'Citizen Portal',
        points: ['Profile + complaint count', 'Live status tracking', 'Fast issue reporting']
    },
    {
        icon: <HiOutlineWrenchScrewdriver />,
        title: 'Sub Office Portal',
        points: ['Office-wise complaint queue', 'Resolved vs unresolved metrics', 'Area-wise workload visibility']
    },
    {
        icon: <HiOutlineBuildingOffice />,
        title: 'Admin Control Center',
        points: ['Create and manage offices', 'Sensitive zone and user governance', 'System-level analytics board']
    }
];

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
            <section className="home-hero">
                <div className="home-hero__bg" aria-hidden="true">
                    <div className="home-hero__orb home-hero__orb--a" />
                    <div className="home-hero__orb home-hero__orb--b" />
                    <div className="home-hero__grid" />
                    <div className="home-hero__city" />
                </div>

                <div className="container home-hero__content">
                    <div className="home-hero__identity">
                        <CiviSenseLogo size={74} className="home-hero__logo" />
                        <div>
                            <span className="section-tag">GovTech Command Interface</span>
                            <h1>
                                CiviSense App
                                <span>Making Cities Better, Together</span>
                            </h1>
                        </div>
                    </div>

                    <p>
                        CiviSense is our civic app and web platform to connect citizens, sub-offices,
                        and admins in one transparent grievance workflow.
                    </p>
                    <p className="home-hero__motive">
                        <strong>App Motive:</strong> Every street issue should be visible, trackable, and resolved with accountability.
                    </p>

                    <div className="home-hero__actions">
                        <a href={appConfig.androidApkUrl} className="btn btn-primary btn-lg" target="_blank" rel="noreferrer">
                            <HiOutlineArrowDownTray /> Download Android APK
                        </a>
                        <Link to="/about" className="btn btn-secondary btn-lg">Explore Platform</Link>
                        <Link to="/login" className="btn btn-ghost btn-lg">Login Portal</Link>
                    </div>

                    <div className="home-hero__stats">
                        <div>
                            <strong>3</strong>
                            <span>Role Portals</span>
                        </div>
                        <div>
                            <strong>24/7</strong>
                            <span>Status Visibility</span>
                        </div>
                        <div>
                            <strong>AI</strong>
                            <span>Priority Engine</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="role-section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">Access Layers</span>
                        <h2>Unified Portals for Every Governance Role</h2>
                    </div>
                    <div className="role-grid">
                        {rolePortals.map((portal) => (
                            <article key={portal.title} className="role-card card">
                                <div className="role-card__icon">{portal.icon}</div>
                                <h3>{portal.title}</h3>
                                <ul>
                                    {portal.points.map((point) => (
                                        <li key={point}>{point}</li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="feature-section">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">Core Capabilities</span>
                        <h2>Built for Real Municipal Operations</h2>
                    </div>
                    <div className="feature-grid">
                        {platformFeatures.map((feature, index) => (
                            <article key={feature.title} className="feature-card card" style={{ animationDelay: `${index * 0.08}s` }}>
                                <div className="feature-card__icon">{feature.icon}</div>
                                <h3>{feature.title}</h3>
                                <p>{feature.desc}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section id="app-download" className="app-promo-section">
                <div className="container app-promo">
                    <div>
                        <span className="section-tag">Mobile Command</span>
                        <h2>CiviSense Mobile App Promotion</h2>
                        <p>
                            Download the Android APK from our latest release and experience real-time civic issue
                            tracking directly from your phone.
                        </p>
                        <div className="app-promo__actions">
                            <a href={appConfig.androidApkUrl} className="btn btn-primary" target="_blank" rel="noreferrer">
                                Get Android APK
                            </a>
                            <button type="button" className="btn btn-secondary" disabled>
                                iOS Build (Soon)
                            </button>
                        </div>
                        <p className="app-promo__ios-note">{appConfig.iosNote}</p>
                    </div>

                    <div className="app-mockup" aria-hidden="true">
                        <div className="app-mockup__screen">
                            <div className="app-mockup__bar" />
                            <div className="app-mockup__card" />
                            <div className="app-mockup__card app-mockup__card--small" />
                            <div className="app-mockup__pulse" />
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
