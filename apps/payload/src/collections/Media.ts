import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
    access: {
        read: () => true,
    },
    slug: 'media',
    upload: {
        staticDir: 'media',
        mimeTypes: ['image/*'],
        imageSizes: [
            {
                name: 'thumbnail',
                width: 400,
                height: 300,
                position: 'centre',
            },
        ],
        adminThumbnail: 'thumbnail',
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
            required: true,
            label: 'Alt Text',
        },
    ],
}