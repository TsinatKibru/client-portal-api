import { PrismaClient, Role, ProjectStatus, InvoiceStatus, Client, Project } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('password123', 10);

    // 1. Create Business
    const business = await prisma.business.upsert({
        where: { slug: 'acme-corp' },
        update: {},
        create: {
            name: 'Acme Corp',
            slug: 'acme-corp',
            status: 'ACTIVE',
            currency: 'USD',
            brandColor: '#065106',
            address: '123 Business St, Enterprise City',
            taxId: 'TX-123456',
        },
    });

    console.log('Created Business:', business.name);

    // 2. Create Owner User
    const owner = await prisma.user.upsert({
        where: { email: 'owner@acme.com' },
        update: {},
        create: {
            email: 'owner@acme.com',
            password,
            role: Role.OWNER,
            businessId: business.id,
        },
    });

    console.log('Created Owner:', owner.email);

    // 3. Create Admin User
    const admin = await prisma.user.upsert({
        where: { email: 'admin@acme.com' },
        update: {},
        create: {
            email: 'admin@acme.com',
            password,
            role: Role.ADMIN,
            businessId: business.id,
        },
    });

    console.log('Created Admin:', admin.email);

    // 4. Create Multiple Clients
    const clientData = [
        { name: 'John Doe', email: 'client1@gmail.com', phone: '+123456789' },
        { name: 'Jane Smith', email: 'client2@gmail.com', phone: '+987654321' },
        { name: 'Tech Solutions Inc', email: 'contact@techsol.com', phone: '+112233445' },
    ];

    const clients: Client[] = [];
    for (const data of clientData) {
        const user = await prisma.user.upsert({
            where: { email: data.email },
            update: {},
            create: {
                email: data.email,
                password,
                role: Role.CLIENT,
                businessId: business.id,
            },
        });

        // Check if client already exists by userId
        let client = await prisma.client.findUnique({
            where: { userId: user.id }
        });

        if (client) {
            client = await prisma.client.update({
                where: { id: client.id },
                data: {
                    name: data.name,
                    phone: data.phone,
                }
            });
        } else {
            client = await prisma.client.create({
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    businessId: business.id,
                    userId: user.id,
                },
            });
        }
        clients.push(client);
        console.log('Created/Updated Client:', client.name);
    }

    // 5. Create Projects
    const projectData = [
        { title: 'Website Redesign', status: ProjectStatus.IN_PROGRESS, clientIdx: 0 },
        { title: 'Mobile App Development', status: ProjectStatus.PENDING, clientIdx: 1 },
        { title: 'Cloud Migration', status: ProjectStatus.DELIVERED, clientIdx: 2 },
        { title: 'SEO Optimization', status: ProjectStatus.IN_PROGRESS, clientIdx: 0 },
    ];

    const projects: Project[] = [];
    for (const data of projectData) {
        // We use create here; for a more robust seed you might want to findUnique by title/client
        const project = await prisma.project.create({
            data: {
                title: data.title,
                description: `Description for ${data.title}`,
                status: data.status,
                businessId: business.id,
                clientId: clients[data.clientIdx].id,
            },
        });
        projects.push(project);
        console.log('Created Project:', project.title);
    }

    // 6. Create Invoices
    const invoiceData = [
        { num: 'INV-2023-001', amount: 1500, status: InvoiceStatus.SENT, clientIdx: 0 },
        { num: 'INV-2023-002', amount: 2500, status: InvoiceStatus.PAID, clientIdx: 1 },
        { num: 'INV-2023-003', amount: 500, status: InvoiceStatus.DRAFT, clientIdx: 2 },
    ];

    for (const data of invoiceData) {
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: data.num,
                amount: data.amount,
                status: data.status,
                subtotal: data.amount,
                tax: 0,
                total: data.amount,
                businessId: business.id,
                clientId: clients[data.clientIdx].id,
                lineItems: [
                    { description: 'Service Item', quantity: 1, rate: data.amount, tax: 0 }
                ],
            },
        });
        console.log('Created Invoice:', invoice.invoiceNumber);
    }

    // 7. Create Activities
    for (const project of projects) {
        await prisma.activity.create({
            data: {
                type: 'PROJECT_CREATED',
                description: `Project "${project.title}" was created`,
                userId: owner.id,
                projectId: project.id,
                businessId: business.id,
            },
        });
    }

    // 8. Create Comments
    if (projects.length > 0) {
        await prisma.comment.create({
            data: {
                content: 'Looking forward to the results!',
                userId: clients[0].userId!,
                projectId: projects[0].id,
            }
        });
        await prisma.comment.create({
            data: {
                content: 'We are starting the design phase now.',
                userId: admin.id,
                projectId: projects[0].id,
            }
        });
    }

    // 9. Create Notifications
    await prisma.notification.create({
        data: {
            type: 'PROJECT_CREATED',
            message: 'A new project "Website Redesign" has been created for you.',
            userId: clients[0].userId!,
            businessId: business.id,
            projectId: projects[0].id,
            read: false,
        }
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
