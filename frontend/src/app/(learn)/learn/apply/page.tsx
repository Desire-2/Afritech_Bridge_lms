'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ApplyPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to courses page where users can browse and apply
		router.push('/courses');
	}, [router]);

	return (
		<section
			className="min-h-screen flex items-center justify-center py-16"
			style={{ background: 'linear-gradient(180deg, #071425 0%, #0b2840 100%)' }}
		>
			<div className="text-white text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
				<p>Redirecting to courses...</p>
			</div>
		</section>
	)
}