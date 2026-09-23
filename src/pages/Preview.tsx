import { useState } from 'react'
import { type UseFormGetValues } from 'react-hook-form'
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarGroup, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RefreshCcw } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';


function Preview({ getValues }: { getValues: UseFormGetValues<any> }) {
    const [values, setValues] = useState<any>({});
    const handleLogFormData = () => {
        const currentValues = getValues();
        console.log(currentValues);
        setValues(currentValues);
    };

    // values.components.map((c) => {
    //     console.log(c)
    // })

    const formatVals = (fv: FormValue) => {
        if (Array.isArray(fv.value)) {
            return (
                <TableRow key={fv.key}>
                    <TableCell colSpan={2}>
                        <span className='font-light text-gray-600'>{fv.label}</span>
                        <Table className='mt-2'>
                            <TableBody>
                                {fv.value.map((v, i) => (
                                    <TableRow key={`${fv.key}-${i}`}>
                                        <TableCell className='text-xs font-light text-gray-600'>{`Tier ${v.index + 1}: `}</TableCell>
                                        <TableCell className='text-xs font-semibold text-right'>{v.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableCell>
                </TableRow>

            )

        }
        return (
            <TableRow key={fv.key}>
                <TableCell className='font-light text-gray-600'>{fv.label}</TableCell>
                <TableCell className='font-semibold text-right'>{fv.value}</TableCell>
            </TableRow>
        )
    }

    interface FormValue {
        label: string
        key: string
        value: any
    }


    const overviewValues = [
        {
            label: 'Name',
            key: 'name',
            value: values.name
        },
        {
            label: 'Due Date',
            key: 'dueDate',
            value: values.dueDate ? new Date(values.dueDate).toLocaleDateString("en-US") : ""
        },
        {
            label: 'Customer',
            key: 'cust',
            value: values.customer
        },
        {
            label: 'Customer Number',
            key: 'custNum',
            value: values.customerNumber
        },
        {
            label: 'Sales Rep',
            key: 'salesRep',
            value: values.salesRep
        },
        {
            label: 'Job Type',
            key: 'jobType',
            value: values.jobType
        },
        {
            label: 'Is this a kit?',
            key: 'isKit',
            value: values.kittingRequired
        },
        {
            label: 'Quantity:',
            key: 'qty',
            value: (values.qty ?? []).map((item: { qty?: number; }, index: number) => ({
                index: index,
                name: String(item.qty ?? ''),
                value: item.qty ?? '',
            })),
        }
    ]

    // console.log("All form values in real-time:", overviewValues);
    // Example output: { firstName: "Jane", lastName: "Doe", age: 30 }
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarTrigger className='absolute right-[-35px]' />
                <SidebarContent>

                    <SidebarGroup>
                        <div className='flex justify-between'>
                            <h4 className='text-xl'>Preview RFE</h4>
                            <Button size='icon-sm' onClick={handleLogFormData}>
                                <RefreshCcw />
                            </Button>
                        </div>
                    </SidebarGroup>
                    <SidebarGroup className='px-0 pt-0'>
                        <Table>
                            <TableBody>
                                {overviewValues
                                    .filter((v) =>
                                        Array.isArray(v.value)
                                            ? v.value.some((item) => String(item.name ?? '').trim() !== '' && String(item.name ?? '').trim() !== 'NaN')
                                            : v.value !== undefined &&
                                            v.value !== null &&
                                            String(v.value).trim() !== ''
                                    )
                                    .map((v) => formatVals(v))}
                            </TableBody>
                        </Table>
                    </SidebarGroup>
                    <SidebarGroup className='px-0 pt-0'>
                        {(values.components ?? []).map((c: any) => (
                            <div key={c.id}>
                                <span className='font-light text-gray-600 text-sm'>{c.name}</span>
                                <Table className='mt-2'>

                                    <TableBody>
                                        {c.qty &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Qty</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.qty}</TableCell>
                                            </TableRow>
                                        }
                                        {(c.type && !c.otherType) &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Type</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.type}</TableCell>
                                            </TableRow>
                                        }
                                        {c.otherType &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Type</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.otherType}</TableCell>
                                            </TableRow>
                                        }
                                        {c.finalSize &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Final Size</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.finalSize}</TableCell>
                                            </TableRow>
                                        }
                                        {c.flatSize &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Flat Size</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.flatSize}</TableCell>
                                            </TableRow>
                                        }
                                        {c.stock &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Stock</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.stock}</TableCell>
                                            </TableRow>
                                        }
                                        {c.coating &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Coating</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.coating}</TableCell>
                                            </TableRow>
                                        }
                                        {c.source &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Source</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.source}</TableCell>
                                            </TableRow>
                                        }
                                        {c.sourceJobNumber &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Job #</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.sourceJobNumber}</TableCell>
                                            </TableRow>
                                        }
                                        {c.instruction &&
                                            <TableRow>
                                                <TableCell className='text-xs font-light text-gray-600'>Instruction</TableCell>
                                                <TableCell className='text-xs font-semibold text-right'>{c.instruction}</TableCell>
                                            </TableRow>
                                        }
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                    </SidebarGroup>
                    <SidebarGroup>
                        {(values.packs ?? []).map((p: any, i: number) => (
                            <div key={p.id}>
                                <span className='font-light text-gray-600 text-sm'>Pack {i + 1}</span>
                                <Table>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Quantity</TableCell>
                                            <TableCell>{p.qty}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Quantity</TableCell>
                                            <TableCell>{p.qty}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                        ))}

                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>

    )
}

export default Preview