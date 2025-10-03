"use client";"use client";"use client";"use client";"use client";"use client";"use client";



import React from 'react';

import Link from 'next/link';

import { useInstructorCourses } from '@/hooks/use-instructor-courses';import React from 'react';



const InstructorCoursesPage = () => {import Link from 'next/link';

  const { courses, loading, error } = useInstructorCourses();

import { useCourses } from '@/hooks/use-courses';import React from 'react';

  if (loading) {

    return (

      <div className="flex items-center justify-center min-h-screen">

        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>interface Course {import Link from 'next/link';

      </div>

    );  id: number;

  }

  title: string;import { useCourses } from '@/hooks/use-courses';import React from 'react';

  if (error) {

    return (  description: string;

      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4">  instructor_name?: string;

          <div className="flex">

            <div className="flex-shrink-0">  instructor_id: number;

              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">

                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />  is_published: boolean;interface Course {import Link from 'next/link';

              </svg>

            </div>  enrollment_count?: number;

            <div className="ml-3">

              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error Loading Courses</h3>  created_at: string;  id: number;

              <div className="mt-2 text-sm text-red-700 dark:text-red-300">

                <p>{error}</p>  updated_at: string;

                <p className="mt-1 text-xs">Please ensure you are logged in with instructor privileges.</p>

              </div>}  title: string;import { useCourses } from '@/hooks/use-courses';import React from 'react';

            </div>

          </div>

        </div>

      </div>const CoursesPage = () => {  description: string;

    );

  }  const { courses, loading, error } = useCourses();



  return (  instructor_name?: string;

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <div className="flex justify-between items-center mb-8">  if (loading) {

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>

        <Link href="/instructor/courses/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">    return (  instructor_id: number;

          Create New Course

        </Link>      <div className="flex items-center justify-center min-h-screen">

      </div>

        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>  is_published: boolean;const CoursesPage = () => {import Link from 'next/link';

      {courses.length === 0 ? (

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">      </div>

          <p className="text-slate-600 dark:text-slate-400 mb-4">

            You haven't created any courses yet. Start by creating your first course.    );  enrollment_count?: number;

          </p>

          <Link href="/instructor/courses/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">  }

            Create Your First Course

          </Link>  created_at: string;  const { courses, loading, error } = useCourses();

        </div>

      ) : (  if (error) {

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {courses.map((course) => (    return (  updated_at: string;

            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">

              <div className="flex justify-between items-start mb-4">      <div className="max-w-4xl mx-auto px-4 py-8">

                <h3 className="text-xl font-semibold text-slate-900 dark:text-white line-clamp-2">

                  {course.title}        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md mx-auto">}import { useCourses } from '@/hooks/use-courses';import React from 'react';import React, { useContext, useEffect, useState } from 'react';

                </h3>

                <span className={`px-2 py-1 text-xs font-medium rounded-full ${          <div className="flex">

                  course.is_published 

                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'             <div className="flex-shrink-0">

                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'

                }`}>              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">

                  {course.is_published ? 'Published' : 'Draft'}

                </span>                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />const CoursesPage = () => {  if (loading) {

              </div>

                            </svg>

              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">

                {course.description}            </div>  const { courses, loading, error } = useCourses();

              </p>

                          <div className="ml-3">

              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">

                <span>              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error Loading Courses</h3>    return (

                  Students enrolled: {course.enrollment_count || 0}

                </span>              <div className="mt-2 text-sm text-red-700 dark:text-red-300">

              </div>

                              <p>{error}</p>  if (loading) {

              <div className="flex space-x-2">

                <Link href={`/instructor/courses/${course.id}`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">              </div>

                  Manage

                </Link>            </div>    return (      <div className="flex items-center justify-center min-h-screen">

                <Link href={`/courses/${course.id}`} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">

                  View          </div>

                </Link>

              </div>        </div>      <div className="flex items-center justify-center min-h-screen">

            </div>

          ))}      </div>

        </div>

      )}    );        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>const CoursesPage = () => {import Link from 'next/link';import Link from 'next/link';

    </div>

  );  }

};

      </div>

export default InstructorCoursesPage;
  return (

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">    );      </div>

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>  }

        <Link href="/instructor/courses/create" legacyBehavior>

          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">    );  const { courses, loading, error } = useCourses();

            Create New Course

          </a>  if (error) {

        </Link>

      </div>    return (  }



      {courses.length === 0 ? (      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

          <p className="text-slate-600 dark:text-slate-400 mb-4">        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md mx-auto">import { useCourses } from '@/hooks/use-courses';import { AuthContext } from '@/contexts/AuthContext';

            You haven't created any courses yet. Start by creating your first course.

          </p>          <div className="flex">

          <Link href="/instructor/courses/create" legacyBehavior>

            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">            <div className="flex-shrink-0">  if (error) {

              Create Your First Course

            </a>              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">

          </Link>

        </div>                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />    return (  if (loading) {

      ) : (

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">              </svg>

          {courses.map((course) => (

            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">            </div>      <div className="text-center py-10">

              <div className="flex justify-between items-start mb-4">

                <h3 className="text-xl font-semibold text-slate-900 dark:text-white line-clamp-2">            <div className="ml-3">

                  {course.title}

                </h3>              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error Loading Courses</h3>        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md mx-auto">    return (

                <span className={`px-2 py-1 text-xs font-medium rounded-full ${

                  course.is_published               <div className="mt-2 text-sm text-red-700 dark:text-red-300">

                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 

                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'                <p>{error}</p>          <p className="text-red-800 dark:text-red-200">Error: {error}</p>

                }`}>

                  {course.is_published ? 'Published' : 'Draft'}              </div>

                </span>

              </div>            </div>        </div>      <div className="flex items-center justify-center min-h-screen">

              

              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">          </div>

                {course.description}

              </p>        </div>      </div>

              

              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">      </div>

                <span>

                  {course.enrollment_count || 0} students    );    );        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>const CoursesPage = () => {interface Course {

                </span>

                {course.instructor_name && (  }

                  <span>By {course.instructor_name}</span>

                )}  }

              </div>

                return (

              <div className="flex space-x-2">

                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">      </div>

                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">

                    Manage      <div className="flex justify-between items-center mb-8">

                  </a>

                </Link>        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>  return (

                <Link href={`/courses/${course.id}`} legacyBehavior>

                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">        <Link href="/instructor/courses/create" legacyBehavior>

                    View

                  </a>          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">    <div className="space-y-6">    );  const { courses, loading, error } = useCourses();  id: number;

                </Link>

              </div>            Create New Course

            </div>

          ))}          </a>      <div className="flex justify-between items-center">

        </div>

      )}        </Link>

    </div>

  );      </div>        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>  }

};



export default CoursesPage;
      {courses.length === 0 ? (        <Link href="/instructor/courses/create" legacyBehavior>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

          <p className="text-slate-600 dark:text-slate-400 mb-4">          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">  title: string;

            You haven't created any courses yet. Start by creating your first course.

          </p>            Create New Course

          <Link href="/instructor/courses/create" legacyBehavior>

            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">          </a>  if (error) {

              Create Your First Course

            </a>        </Link>

          </Link>

        </div>      </div>    return (  if (loading) return <div className="text-center py-10">Loading courses...</div>;  description: string;

      ) : (

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {courses.map((course) => (

            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">      {courses.length === 0 ? (      <div className="text-center py-10">

              <div className="flex justify-between items-start mb-4">

                <h3 className="text-xl font-semibold text-slate-900 dark:text-white line-clamp-2">        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

                  {course.title}

                </h3>          <p className="text-slate-600 dark:text-slate-400 mb-4">        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md mx-auto">  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;  instructor_name: string;

                <span className={`px-2 py-1 text-xs font-medium rounded-full ${

                  course.is_published             You haven't created any courses yet.

                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 

                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'          </p>          <p className="text-red-800 dark:text-red-200">Error: {error}</p>

                }`}>

                  {course.is_published ? 'Published' : 'Draft'}          <Link href="/instructor/courses/create" legacyBehavior>

                </span>

              </div>            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">        </div>  is_published: boolean;

              

              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">              Create Your First Course

                {course.description}

              </p>            </a>      </div>

              

              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">          </Link>

                <span>

                  {course.enrollment_count || 0} students        </div>    );  return (  created_at: string;

                </span>

                {course.instructor_name && (      ) : (

                  <span>By {course.instructor_name}</span>

                )}        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">  }

              </div>

                        {courses.map((course) => (

              <div className="flex space-x-2">

                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">    <div className="space-y-6">  enrollment_count?: number;

                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">

                    Manage              <div className="flex justify-between items-start mb-3">

                  </a>

                </Link>                <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">  return (

                <Link href={`/courses/${course.id}`} legacyBehavior>

                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">                  {course.title}

                    View

                  </a>                </h3>    <div className="space-y-6">      <div className="flex justify-between items-center">}

                </Link>

              </div>                <span className={`px-2 py-1 text-xs font-medium rounded-full ${

            </div>

          ))}                  course.is_published      <div className="flex justify-between items-center">

        </div>

      )}                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'

    </div>

  );                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>

};

                }`}>

export default CoursesPage;
                  {course.is_published ? 'Published' : 'Draft'}        <Link href="/instructor/courses/create" legacyBehavior>

                </span>

              </div>          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">        <Link href="/instructor/courses/create" legacyBehavior>"use client";



              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">            Create New Course

                {course.description}

              </p>          </a>          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">



              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">        </Link>

                <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>

                {course.instructor_name && (      </div>            Create New Courseimport React from 'react';

                  <span>By: {course.instructor_name}</span>

                )}

              </div>

      {courses.length === 0 ? (          </a>import Link from 'next/link';

              <div className="flex gap-2">

                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">

                    Manage          <p className="text-slate-600 dark:text-slate-400 mb-4">        </Link>import { useCourses } from '@/hooks/use-courses';

                  </a>

                </Link>            You haven't created any courses yet.

                <Link href={`/courses/${course.id}`} legacyBehavior>

                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">          </p>      </div>

                    View

                  </a>          <Link href="/instructor/courses/create" legacyBehavior>

                </Link>

              </div>            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">const CoursesPage = () => {

            </div>

          ))}              Create Your First Course

        </div>

      )}            </a>      {courses.length === 0 ? (  const { courses, loading, error } = useCourses();

    </div>

  );          </Link>

};

        </div>        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

export default CoursesPage;
      ) : (

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">          <p className="text-slate-600 dark:text-slate-400 mb-4">  if (loading) return <div className="text-center py-10">Loading courses...</div>;

          {courses.map((course) => (

            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">            You haven't created any courses yet.  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;

              <div className="flex justify-between items-start mb-3">

                <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">          </p>

                  {course.title}

                </h3>          <Link href="/instructor/courses/create" legacyBehavior>  return (

                <span className={`px-2 py-1 text-xs font-medium rounded-full ${

                  course.is_published            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">    <div className="space-y-6">

                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'

                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'              Create Your First Course      <div className="flex justify-between items-center">

                }`}>

                  {course.is_published ? 'Published' : 'Draft'}            </a>        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>

                </span>

              </div>          </Link>        <Link href="/instructor/courses/create" legacyBehavior>



              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">        </div>          <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">

                {course.description}

              </p>      ) : (            Create New Course



              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">          </a>

                <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>

                {course.instructor_name && (          {courses.map((course) => (        </Link>

                  <span>By: {course.instructor_name}</span>

                )}            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">      </div>

              </div>

              <div className="flex justify-between items-start mb-3">

              <div className="flex gap-2">

                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>                <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">      {courses.length === 0 ? (

                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">

                    Manage                  {course.title}        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">

                  </a>

                </Link>                </h3>          <p className="text-slate-600 dark:text-slate-400 mb-4">

                <Link href={`/courses/${course.id}`} legacyBehavior>

                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium transition-colors">                <span className={`px-2 py-1 text-xs font-medium rounded-full ${            You haven't created any courses yet.

                    View

                  </a>                  course.is_published          </p>

                </Link>

              </div>                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'          <Link href="/instructor/courses/create" legacyBehavior>

            </div>

          ))}                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'            <a className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">

        </div>

      )}                }`}>              Create Your First Course

    </div>

  );                  {course.is_published ? 'Published' : 'Draft'}            </a>

};

                </span>          </Link>

export default CoursesPage;
              </div>        </div>

      ) : (

              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                {course.description}          {courses.map((course) => (

              </p>            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">

              <div className="flex justify-between items-start mb-3">

              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">                <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">

                <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>                  {course.title}

                <span>Instructor: {course.instructor_name}</span>                </h3>

              </div>                <span className={`px-2 py-1 text-xs font-medium rounded-full ${

                  course.is_published

              <div className="flex gap-2">                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'

                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'

                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium">                }`}>

                    Manage                  {course.is_published ? 'Published' : 'Draft'}

                  </a>                </span>

                </Link>              </div>

                <Link href={`/courses/${course.id}`} legacyBehavior>

                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium">              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">

                    View                {course.description}

                  </a>              </p>

                </Link>

              </div>              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 mb-4">

            </div>                <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>

          ))}                <span>Instructor: {course.instructor_name}</span>

        </div>              </div>

      )}

    </div>              <div className="flex gap-2">

  );                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>

};                  <a className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-3 rounded text-sm font-medium">

                    Manage

export default CoursesPage;                  </a>
                </Link>
                <Link href={`/courses/${course.id}`} legacyBehavior>
                  <a className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-center py-2 px-3 rounded text-sm font-medium">
                    View
                  </a>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;"
