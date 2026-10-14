import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Question } from '@/payload-types'

const toLexical = (text: string): Question['stimulus'] => ({
    root: {
        type: 'root',
        children: [
            {
                type: 'paragraph',
                children: [
                    {
                        type: 'text',
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: text || '',
                        version: 1,
                    },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
            },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
    },
});

const cleanOption = (text: string): string => {
    if (!text) return '';
    let cleaned = text.trim();

    cleaned = cleaned.replace(/^Option\s+[A-D]\b[:.-]?\s*/i, '').trim();
    cleaned = cleaned.replace(/^[A-D][.:)-]\s+/i, '').trim();

    if (!cleaned) return text.trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const getDomainAndSubCategory = (section: string, rawDomain: string, rawSkill: string) => {
    const dom = (rawDomain || '').toLowerCase();
    const skill = (rawSkill || '').toLowerCase();
    const result: Record<string, string> = {};

    if (section === 'english') {
        if (dom.includes('craft')) {
            result.domain = 'craft';
            if (skill.includes('context') || skill.includes('vocab')) result.craft = 'vocabulary';
            else if (skill.includes('structure') || skill.includes('purpose')) result.craft = 'purpose';
            else if (skill.includes('connection')) result.craft = 'connections';
            else result.craft = 'vocabulary';
        } else if (dom.includes('idea')) {
            result.domain = 'ideas';
            if (skill.includes('central') || skill.includes('detail')) result.ideas = 'details';
            else if (skill.includes('textual')) result.ideas = 'evidence_text';
            else if (skill.includes('quant') || skill.includes('graph')) result.ideas = 'evidence_graph';
            else if (skill.includes('infer')) result.ideas = 'inferences';
            else result.ideas = 'details';
        } else if (dom.includes('convention')) {
            result.domain = 'conventions';
            if (skill.includes('bound')) result.conventions = 'punctuation';
            else if (skill.includes('form') || skill.includes('sense') || skill.includes('gram')) result.conventions = 'grammar';
            else result.conventions = 'grammar';
        } else if (dom.includes('expression')) {
            result.domain = 'expression';
            if (skill.includes('rhetor')) result.expression = 'rhetorical';
            else if (skill.includes('transit')) result.expression = 'transitions';
            else result.expression = 'transitions';
        } else {
            result.domain = 'ideas';
            result.ideas = 'details';
        }
    } else {
        if (dom.includes('algebra')) {
            result.topic = 'algebra';
            if (skill.includes('one variable')) result.algebra = 'linear_one';
            else if (skill.includes('two variables')) result.algebra = 'linear_two';
            else if (skill.includes('systems')) result.algebra = 'linear_systems';
            else result.algebra = 'linear_functions';
        } else if (dom.includes('advanced')) {
            result.topic = 'advanced';
            if (skill.includes('equiv')) result.advanced = 'equivalent';
            else if (skill.includes('quad') || skill.includes('expon')) result.advanced = 'quadratics';
            else if (skill.includes('nonlinear')) result.advanced = 'nonlinear_systems';
            else result.advanced = 'quadratics';
        } else if (dom.includes('problem') || dom.includes('data')) {
            result.topic = 'problem';
            if (skill.includes('ratio') || skill.includes('rate')) result.problem = 'ratios';
            else if (skill.includes('percent')) result.problem = 'percentages';
            else if (skill.includes('probab')) result.problem = 'probability';
            else if (skill.includes('stat') || skill.includes('margin')) result.problem = 'statistics';
            else result.problem = 'percentages';
        } else if (dom.includes('geometry') || dom.includes('trig')) {
            result.topic = 'geometry';
            if (skill.includes('area') || skill.includes('vol')) result.geometry = 'geometry_3d';
            else if (skill.includes('angle') || skill.includes('line')) result.geometry = 'triangles';
            else if (skill.includes('right') || skill.includes('trig')) result.geometry = 'trig';
            else if (skill.includes('circle')) result.geometry = 'circles';
            else result.geometry = 'triangles';
        } else {
            result.topic = 'algebra';
            result.algebra = 'linear_one';
        }
    }
    return result;
};

export async function GET(request: Request) {
    const payload = await getPayload({ config });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '5';
    const limit = limitParam === 'all' ? Infinity : parseInt(limitParam, 10);

    const shouldClear = searchParams.get('clear') === 'true';

    try {
        if (shouldClear) {
            await payload.delete({
                collection: 'questions',
                where: { id: { exists: true } }
            });
        }

        const response = await fetch('https://api.jsonsilo.com/public/942c3c3b-3a0c-4be3-81c2-12029def19f5');
        const data = await response.json() as Record<string, any>;

        const sections = ['english', 'math'] as const;
        let totalCount = 0;

        for (const section of sections) {
            let sectionCount = 0;
            let questions = [];

            if (section === 'english') {
                questions = data['english'] || data['reading'] || data['reading_writing'] || data['rw'] || data['verbal'] || data['writing'] || [];
            } else {
                questions = data['math'] || data['mathematics'] || [];
            }

            for (const item of questions) {
                if (sectionCount >= limit) break;

                const passage = item.question?.paragraph === 'null' ? '' : (item.question?.paragraph || '');
                const questionText = item.question?.question || '';
                const stimulusText = passage ? `${passage}\n\n${questionText}` : questionText;

                const rawChoices = item.question?.choices || {};
                const rawAnswerKey = String(item.question?.correct_answer || 'A').trim().toUpperCase();

                let choicesEntries: [string, any][] = [];
                if (Array.isArray(rawChoices)) {
                    choicesEntries = rawChoices.map((val, index) => {
                        const letter = String.fromCharCode(65 + index);
                        return [letter, val];
                    });
                } else if (typeof rawChoices === 'object' && rawChoices !== null) {
                    choicesEntries = Object.entries(rawChoices);
                }

                const seenCleanedTexts = new Set<string>();
                const optionsArray: Array<{ key: string; text: string }> = [];

                choicesEntries.forEach(([key, val]) => {
                    let cleanedText = cleanOption(String(val));
                    const optionLetter = key.trim().toUpperCase();

                    if (seenCleanedTexts.has(cleanedText)) {
                        cleanedText = String(val).trim();
                    }
                    seenCleanedTexts.add(cleanedText);

                    optionsArray.push({
                        key: optionLetter,
                        text: cleanedText
                    });
                });

                const finalAnswerLetter = ['A', 'B', 'C', 'D'].includes(rawAnswerKey) ? rawAnswerKey : 'A';

                const rawExplanation = item.question?.explanation === 'null' ? '' : (item.question?.explanation || '');
                const categorization = getDomainAndSubCategory(section, item.domain, item.skill);

                await payload.create({
                    collection: 'questions',
                    data: {
                        section: section,
                        ...categorization,
                        stimulus: toLexical(stimulusText),
                        options: optionsArray,
                        answer: finalAnswerLetter,
                        explanation: toLexical(rawExplanation),
                        difficulty: (item.difficulty || 'medium').toLowerCase(),
                        weight: 1.0,
                        duration: section === 'math' ? 90 : 60,
                        status: 'active',
                    },
                });

                sectionCount++;
                totalCount++;
            }
        }

        return NextResponse.json({ success: true, message: `Successfully appended ${totalCount} questions total!` });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}