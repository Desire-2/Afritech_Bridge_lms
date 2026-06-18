'use client';

import React, { useState } from 'react';
import AdminApplicationsManager from '@/components/applications/AdminApplicationsManager';
import SavedApplicationsManager from '@/components/applications/SavedApplicationsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, CheckSquare } from 'lucide-react';

export default function AdminApplicationsPage() {
  const [activeTab, setActiveTab] = useState('submitted');

  return (
    <div className="container mx-auto py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="submitted" className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            Submitted Applications
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Saved (Draft) Applications
          </TabsTrigger>
        </TabsList>
        <TabsContent value="submitted">
          <AdminApplicationsManager />
        </TabsContent>
        <TabsContent value="saved">
          <SavedApplicationsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
