import PublicLayout from '../../components/Layout/PublicLayout';
import {
    HiOutlineArrowPath,
    HiOutlineBuildingOffice,
    HiOutlineChartBar,
    HiOutlineCpuChip,
    HiOutlineMapPin,
    HiOutlineShieldCheck,
    HiOutlineUserGroup,
    HiOutlineWrenchScrewdriver
} from 'react-icons/hi2';
import './About.css';

const projectBlocks = [
    {
        icon: <HiOutlineUserGroup />,
        title: 'Citizen Experience',
        items: [
            'Profile-based login with personal report history',
            'Live status visibility from report to resolution',
            'Clear timeline and accountability for each grievance'
        ]
    },
    {
        icon: <HiOutlineWrenchScrewdriver />,
        title: 'Sub Office Workflow',
        items: [
            'Office-specific queues and actionable complaint boards',
            'Resolved vs unresolved metrics by area',
            'Structured status updates with traceable responsibility'
        ]
    },
    {
        icon: <HiOutlineBuildingOffice />,
        title: 'Admin Command',
        items: [
            'Office management with capacity and zone control',
            'Sensitive-location governance and system oversight',
            'Platform-wide analytics for policy and operations'
        ]
    }
];

const workflow = [
    { icon: <HiOutlineMapPin />, title: 'Report Intake', text: 'Issues are reported with description, category, and location context.' },
    { icon: <HiOutlineCpuChip />, title: 'AI Support', text: 'AI helps with categorization, duplicate detection, and priority hints.' },
    { icon: <HiOutlineArrowPath />, title: 'Office Routing', text: 'The platform routes tasks to the correct municipal office flow.' },
    { icon: <HiOutlineChartBar />, title: 'Monitoring', text: 'Progress and resolution performance are tracked in live dashboards.' }
];

const principles = [
    {
        title: 'Transparency First',
        text: 'Citizens and officials should see the same truth about report progress.'
    },
    {
        title: 'Faster Resolution',
        text: 'Routing and prioritization should reduce administrative delay.'
    },
    {
        title: 'Data-Driven Governance',
        text: 'Policy actions should be informed by measurable civic pain points.'
    },
    {
        title: 'Secure Access',
        text: 'Role-based access and audit trails are built into every workflow.'
    }
];

export default function About() {
    return (
        <PublicLayout>
            <section className="about-page__hero">
                <div className="container">
                    <span className="section-tag">About CiviSense</span>
                    <h1>What we are building and why it matters for civic governance.</h1>
                    <p>
                        CiviSense is a civic operations platform built to bridge citizens and municipal systems.
                        Our goal is simple: make local issue reporting transparent, trackable, and faster to resolve.
                    </p>
                </div>
            </section>

            <section className="about-page__purpose">
                <div className="container">
                    <article className="about-purpose-card card">
                        <h2>Project Purpose</h2>
                        <p>
                            We are building one unified system where citizens can view profile and report status,
                            municipal sub-offices can process assigned work with clear workload visibility,
                            and admins can manage offices, sensitive zones, and analytics without operational blind spots.
                        </p>
                    </article>
                </div>
            </section>

            <section className="about-page__blocks">
                <div className="container about-block-grid">
                    {projectBlocks.map((block) => (
                        <article key={block.title} className="about-block-card card">
                            <div className="about-block-card__icon">{block.icon}</div>
                            <h3>{block.title}</h3>
                            <ul>
                                {block.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>

            <section className="about-page__workflow">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag">System Flow</span>
                        <h2>How CiviSense Works End-to-End</h2>
                    </div>
                    <div className="about-workflow-grid">
                        {workflow.map((step) => (
                            <article key={step.title} className="about-workflow-step card">
                                <div className="about-workflow-step__icon">{step.icon}</div>
                                <h3>{step.title}</h3>
                                <p>{step.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="about-page__principles">
                <div className="container">
                    <div className="section-header">
                        <span className="section-tag"><HiOutlineShieldCheck /> Core Principles</span>
                        <h2>Guidelines Behind the Product</h2>
                    </div>
                    <div className="about-principles-grid">
                        {principles.map((principle) => (
                            <article key={principle.title} className="about-principle card">
                                <h3>{principle.title}</h3>
                                <p>{principle.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
