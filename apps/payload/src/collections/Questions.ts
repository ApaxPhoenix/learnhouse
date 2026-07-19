import type { CollectionConfig } from 'payload'
import {
    lexicalEditor,
    FixedToolbarFeature,
    InlineToolbarFeature
} from '@payloadcms/richtext-lexical'

export const Questions: CollectionConfig = {
    access: {
        read: () => true,
    },
    slug: 'questions',
    fields: [
        {
            name: 'stimulus',
            type: 'richText',
            editor: lexicalEditor({
                features: ({ defaultFeatures }) => [
                    ...defaultFeatures,
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                ],
            }),
            required: true,
        },
        {
            name: 'options',
            type: 'array',
            fields: [
                {
                    name: 'text',
                    type: 'text',
                    required: true,
                },
            ],
        },
        {
            name: 'answer',
            type: 'text',
            required: true,
            admin: {
                components: {
                    Field: '@/components/Select#Select',
                },
            },
        },
        {
            name: 'explanation',
            type: 'richText',
            editor: lexicalEditor({
                features: ({ defaultFeatures }) => [
                    ...defaultFeatures,
                    FixedToolbarFeature(),
                    InlineToolbarFeature(),
                ],
            }),
            required: true,
        },
        {
            name: 'section',
            type: 'select',
            required: true,
            options: [
                { label: 'Reading & Writing', value: 'english' },
                { label: 'Math', value: 'math' },
            ],
        },
        {
            name: 'domain',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'english',
            },
            options: [
                { label: 'Craft and Structure', value: 'craft' },
                { label: 'Information and Ideas', value: 'ideas' },
                { label: 'Standard English Conventions', value: 'conventions' },
                { label: 'Expression of Ideas', value: 'expression' },
            ],
        },
        {
            name: 'topic',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'math',
            },
            options: [
                { label: 'Algebra', value: 'algebra' },
                { label: 'Advanced Math', value: 'advanced' },
                { label: 'Problem Solving and Data Analysis', value: 'problem' },
                { label: 'Geometry and Trigonometry', value: 'geometry' },
            ],
        },
        {
            name: 'craft',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'english' && data?.domain === 'craft',
            },
            options: [
                { label: 'Words in Context', value: 'vocabulary' },
                { label: 'Text Structure and Purpose', value: 'purpose' },
                { label: 'Cross-Text Connections', value: 'connections' },
            ],
        },
        {
            name: 'ideas',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'english' && data?.domain === 'ideas',
            },
            options: [
                { label: 'Central Ideas and Details', value: 'details' },
                { label: 'Command of Evidence (Textual)', value: 'evidence_text' },
                { label: 'Command of Evidence (Quantitative)', value: 'evidence_graph' },
                { label: 'Inferences', value: 'inferences' },
            ],
        },
        {
            name: 'conventions',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'english' && data?.domain === 'conventions',
            },
            options: [
                { label: 'Boundaries', value: 'punctuation' },
                { label: 'Form, Structure, and Sense', value: 'grammar' },
            ],
        },
        {
            name: 'expression',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'english' && data?.domain === 'expression',
            },
            options: [
                { label: 'Rhetorical Synthesis', value: 'rhetorical' },
                { label: 'Transitions', value: 'transitions' },
            ],
        },
        {
            name: 'algebra',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'math' && data?.topic === 'algebra',
            },
            options: [
                { label: 'Linear Equations (One Variable)', value: 'linear_one' },
                { label: 'Linear Equations (Two Variables)', value: 'linear_two' },
                { label: 'Linear Functions', value: 'linear_functions' },
                { label: 'Systems of Linear Equations', value: 'linear_systems' },
            ],
        },
        {
            name: 'advanced',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'math' && data?.topic === 'advanced',
            },
            options: [
                { label: 'Equivalent Expressions', value: 'equivalent' },
                { label: 'Quadratic and Exponential Functions', value: 'quadratics' },
                { label: 'Nonlinear Systems', value: 'nonlinear_systems' },
            ],
        },
        {
            name: 'problem',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'math' && data?.topic === 'problem',
            },
            options: [
                { label: 'Ratios, Rates, and Proportions', value: 'ratios' },
                { label: 'Percentages', value: 'percentages' },
                { label: 'Probability and Conditional Probability', value: 'probability' },
                { label: 'Statistics and Margin of Error', value: 'statistics' },
            ],
        },
        {
            name: 'geometry',
            type: 'select',
            admin: {
                condition: (data) => data?.section === 'math' && data?.topic === 'geometry',
            },
            options: [
                { label: 'Area and Volume', value: 'geometry_3d' },
                { label: 'Lines, Angles, and Triangles', value: 'triangles' },
                { label: 'Right Triangles and Trigonometry', value: 'trig' },
                { label: 'Circles', value: 'circles' },
            ],
        },
        {
            name: 'difficulty',
            type: 'select',
            required: true,
            options: [
                { label: 'Easy', value: 'easy' },
                { label: 'Medium', value: 'medium' },
                { label: 'Hard', value: 'hard' },
            ],
        },
        {
            name: 'weight',
            type: 'number',
            required: true,
            defaultValue: 1.0,
        },
        {
            name: 'duration',
            type: 'number',
            required: true,
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Active', value: 'active' },
                { label: 'Archived', value: 'archived' },
            ],
        },
    ],
}