'use client'

import React from 'react'
import { SelectInput, useField, useFormFields } from '@payloadcms/ui'

export const Select: React.FC = () => {
    const { value, setValue, path } = useField<any>({})

    const selectOptions = useFormFields(([fields]) => {
        const keys = Object.keys(fields).filter((key) => /^options\.\d+\.text$/.test(key))

        keys.sort((a, b) => {
            const indexA = parseInt(a.split('.')[1], 10)
            const indexB = parseInt(b.split('.')[1], 10)
            return indexA - indexB
        })

        return keys
            .map((key) => {
                const textValue = fields[key]?.value
                const text = typeof textValue === 'string' ? textValue : ''
                return {
                    label: text || 'Empty Option',
                    value: text, // Points directly to the exact option text value (not the ID)
                }
            })
            .filter((opt) => opt.value !== '')
    })

    const safeValue = typeof value === 'object' && value !== null && 'value' in value
        ? value.value
        : (value as string) ?? ''

    const handleChange = (selected: any) => {
        if (selected && typeof selected === 'object' && 'value' in selected) {
            setValue(selected.value)
        } else {
            setValue(selected)
        }
    }

    return (
        <div className="field-type select" style={{ marginBottom: '24px' }}>
            <label className="field-label" style={{ marginBottom: '4px', display: 'block' }}>
                Correct Answer
            </label>
            <SelectInput
                path={path}
                name="answer"
                value={safeValue}
                onChange={handleChange}
                options={selectOptions}
            />
        </div>
    )
}