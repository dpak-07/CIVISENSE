const isoDaysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const DEMO_COMPLAINTS = [
    {
        _id: 'demo-c-1',
        title: 'Streetlight outage near Ward 11',
        category: 'electricity',
        city: 'Chennai',
        sensitiveLocation: { name: 'Anna Adarsh Senior Secondary School', type: 'school' },
        status: 'resolved',
        priority: { level: 'high' },
        images: [{ url: 'https://civisense-demo.s3.ap-south-1.amazonaws.com/reports/streetlight-ward11.jpg' }],
        reportedBy: { name: 'Asha R', email: 'asha@example.com' },
        createdAt: isoDaysAgo(18)
    },
    {
        _id: 'demo-c-2',
        title: 'Garbage overflow at market junction',
        category: 'waste_management',
        city: 'Chennai',
        sensitiveLocation: { name: 'Hospital Emergency Corridor', type: 'hospital' },
        status: 'in_progress',
        priority: { level: 'high' },
        images: [{ url: 'https://civisense-demo.s3.ap-south-1.amazonaws.com/reports/market-garbage.jpg' }],
        reportedBy: { name: 'Raghu P', email: 'raghu@example.com' },
        createdAt: isoDaysAgo(12)
    },
    {
        _id: 'demo-c-3',
        title: 'Water leakage on Main Road',
        category: 'water_supply',
        city: 'Coimbatore',
        status: 'assigned',
        priority: { level: 'medium' },
        images: [{ url: 'https://civisense-demo.s3.ap-south-1.amazonaws.com/reports/water-leak-mainroad.jpg' }],
        reportedBy: { name: 'Priya K', email: 'priya@example.com' },
        createdAt: isoDaysAgo(10)
    },
    {
        _id: 'demo-c-4',
        title: 'Pothole cluster near bus depot',
        category: 'roads',
        city: 'Madurai',
        status: 'reported',
        priority: { level: 'medium' },
        images: [{ url: 'https://civisense-demo.s3.ap-south-1.amazonaws.com/reports/pothole-busdepot.jpg' }],
        reportedBy: { name: 'Dev S', email: 'dev@example.com' },
        createdAt: isoDaysAgo(9)
    },
    {
        _id: 'demo-c-5',
        title: 'Illegal dumping behind school',
        category: 'waste_management',
        city: 'Trichy',
        status: 'resolved',
        priority: { level: 'low' },
        reportedBy: { name: 'Sana M', email: 'sana@example.com' },
        createdAt: isoDaysAgo(7)
    },
    {
        _id: 'demo-c-6',
        title: 'Traffic signal not working',
        category: 'traffic',
        city: 'Chennai',
        status: 'unassigned',
        priority: { level: 'high' },
        reportedBy: { name: 'Karthik J', email: 'karthik@example.com' },
        createdAt: isoDaysAgo(4)
    },
    {
        _id: 'demo-c-7',
        title: 'Park lights flickering',
        category: 'electricity',
        city: 'Salem',
        status: 'rejected',
        priority: { level: 'low' },
        reportedBy: { name: 'Meera V', email: 'meera@example.com' },
        createdAt: isoDaysAgo(3)
    },
    {
        _id: 'demo-c-8',
        title: 'Drain blockage in Sector 4',
        category: 'sanitation',
        city: 'Erode',
        status: 'resolved',
        priority: { level: 'medium' },
        reportedBy: { name: 'Imran A', email: 'imran@example.com' },
        createdAt: isoDaysAgo(1)
    }
];

export const DEMO_ADMIN_METRICS = {
    totalComplaints: DEMO_COMPLAINTS.length,
    resolvedComplaints: DEMO_COMPLAINTS.filter((c) => c.status === 'resolved').length,
    pendingComplaints: DEMO_COMPLAINTS.filter((c) =>
        ['reported', 'assigned', 'in_progress', 'unassigned'].includes(c.status)
    ).length,
    totalOffices: 5,
    totalUsers: 312,
    avgResolutionHours: 18.4,
    statusBreakdown: {
        reported: DEMO_COMPLAINTS.filter((c) => c.status === 'reported').length,
        assigned: DEMO_COMPLAINTS.filter((c) => c.status === 'assigned').length,
        in_progress: DEMO_COMPLAINTS.filter((c) => c.status === 'in_progress').length,
        resolved: DEMO_COMPLAINTS.filter((c) => c.status === 'resolved').length,
        rejected: DEMO_COMPLAINTS.filter((c) => c.status === 'rejected').length,
        unassigned: DEMO_COMPLAINTS.filter((c) => c.status === 'unassigned').length
    },
    topCategories: [
        { _id: 'waste_management', count: 2 },
        { _id: 'electricity', count: 2 },
        { _id: 'water_supply', count: 1 },
        { _id: 'roads', count: 1 },
        { _id: 'traffic', count: 1 },
        { _id: 'sanitation', count: 1 }
    ]
};

export const DEMO_OFFICES = [
    {
        _id: 'demo-o-1',
        name: 'Central Municipal HQ',
        type: 'main',
        zone: 'Zone A',
        workload: 34,
        maxCapacity: 120,
        isActive: true,
        location: { coordinates: [80.271, 13.083] }
    },
    {
        _id: 'demo-o-2',
        name: 'North Sub Office',
        type: 'sub',
        zone: 'Zone B',
        workload: 22,
        maxCapacity: 80,
        isActive: true,
        location: { coordinates: [80.255, 13.111] }
    },
    {
        _id: 'demo-o-3',
        name: 'South Sub Office',
        type: 'sub',
        zone: 'Zone C',
        workload: 19,
        maxCapacity: 75,
        isActive: true,
        location: { coordinates: [80.285, 13.02] }
    }
];

export const DEMO_SENSITIVE_LOCATIONS = [
    {
        _id: 'demo-s-1',
        name: 'School Safety Zone',
        category: 'school',
        description: 'Area around higher secondary school requiring strict monitoring.',
        radiusMeters: 180,
        isActive: true,
        location: { coordinates: [80.274, 13.072] },
        createdAt: isoDaysAgo(20)
    },
    {
        _id: 'demo-s-2',
        name: 'Hospital Emergency Corridor',
        category: 'hospital',
        description: 'No blockage or dumping allowed in this corridor.',
        radiusMeters: 250,
        isActive: true,
        location: { coordinates: [80.262, 13.087] },
        createdAt: isoDaysAgo(16)
    }
];
