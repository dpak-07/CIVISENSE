import PublicLayout from '../../components/Layout/PublicLayout';
import {
  HiOutlineArrowPath,
  HiOutlineBuildingOffice,
  HiOutlineChartBar,
  HiOutlineCpuChip,
  HiOutlineMapPin,
  HiOutlineShieldCheck,
  HiOutlineUserGroup,
  HiOutlineWrenchScrewdriver,
  HiOutlineSparkles
} from 'react-icons/hi2';
import { motion } from 'framer-motion';
import './About.css';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

const item = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  }
};

const projectBlocks = [
  {
    icon: <HiOutlineUserGroup />,
    title: 'Citizen Experience',
    items: [
      'Profile-based login with report history',
      'Live complaint tracking',
      'Transparent resolution timeline'
    ]
  },
  {
    icon: <HiOutlineWrenchScrewdriver />,
    title: 'Municipal Workflow',
    items: [
      'Department complaint queues',
      'Area-wise performance insights',
      'Operational dashboards'
    ]
  },
  {
    icon: <HiOutlineBuildingOffice />,
    title: 'Admin Control Center',
    items: [
      'Office management and zoning',
      'Sensitive location monitoring',
      'Urban analytics dashboards'
    ]
  }
];

const workflow = [
  {
    icon: <HiOutlineMapPin />,
    title: 'Issue Reporting',
    text: 'Citizens report civic problems with location and images.'
  },
  {
    icon: <HiOutlineCpuChip />,
    title: 'AI Analysis',
    text: 'AI detects category, duplicates and assigns priority.'
  },
  {
    icon: <HiOutlineArrowPath />,
    title: 'Smart Routing',
    text: 'Issues are routed to the correct municipal department.'
  },
  {
    icon: <HiOutlineChartBar />,
    title: 'Monitoring',
    text: 'Authorities track progress and resolution.'
  }
];

const principles = [
  {
    title: 'Transparency',
    text: 'Citizens and authorities share the same real-time data.'
  },
  {
    title: 'Efficiency',
    text: 'Automated routing reduces delays.'
  },
  {
    title: 'Data-Driven Governance',
    text: 'Urban planning decisions rely on civic data.'
  },
  {
    title: 'Security',
    text: 'Role-based access ensures secure governance.'
  }
];

export default function About() {
  return (
    <PublicLayout>
      <section className="about-page__hero">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="section-tag">
              <HiOutlineSparkles /> About CiviSense
            </span>

            <h1>AI Powered Civic Intelligence Platform</h1>

            <p>
              CiviSense modernizes how cities handle civic complaints.
              Citizens report issues like potholes, garbage overflow,
              drainage blockages and water leaks using a simple interface.
            </p>

            <p>
              The AI layer automatically categorizes complaints,
              detects duplicates, assigns priority and routes them
              to the correct municipal department.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="about-page__purpose">
        <div className="container">
          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <motion.div variants={item} className="about-purpose-card">
              <h2>Why CiviSense Exists</h2>

              <p>
                Cities receive thousands of civic complaints daily
                but many remain unresolved due to manual processes
                and lack of coordination between departments.
              </p>

              <p>
                CiviSense bridges citizens and municipal authorities
                using AI-powered automation and real-time monitoring
                to improve transparency and resolution speed.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="about-page__blocks">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Platform Blocks</span>
            <h2>Three Connected Governance Layers</h2>
          </div>

          <motion.div
            className="about-block-grid"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {projectBlocks.map((block) => (
              <motion.article key={block.title} variants={item} whileHover={{ scale: 1.04 }} className="about-block-card">
                <div className="about-block-card__icon">{block.icon}</div>

                <h3>{block.title}</h3>

                <ul>
                  {block.items.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="about-page__workflow">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">System Flow</span>
            <h2>How CiviSense Works</h2>
          </div>

          <motion.div
            className="about-workflow-grid"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {workflow.map((step) => (
              <motion.article key={step.title} variants={item} className="about-workflow-step">
                <div className="about-workflow-step__icon">{step.icon}</div>

                <h3>{step.title}</h3>

                <p>{step.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="about-page__principles">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">
              <HiOutlineShieldCheck /> Core Principles
            </span>
            <h2>Our Vision for Governance</h2>
          </div>

          <motion.div
            className="about-principles-grid"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {principles.map((principle) => (
              <motion.article
                key={principle.title}
                variants={item}
                whileHover={{ y: -6 }}
                className="about-principle"
              >
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
