import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../app/components/Sidebar';
import { Header } from '../app/components/Header';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from 'next/navigation';

const mockedUsePathname = usePathname as unknown as ReturnType<typeof vi.fn>;

describe('Layout Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sidebar', () => {
    it('renders navigation links', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Queue')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows active state for current page', () => {
      mockedUsePathname.mockReturnValue('/tasks');
      render(<Sidebar />);
      
      const tasksLink = screen.getByText('Tasks').closest('a');
      expect(tasksLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not show active state for non-current pages', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      const tasksLink = screen.getByText('Tasks').closest('a');
      expect(tasksLink).not.toHaveAttribute('aria-current');
    });

    it('renders mobile hamburger button', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      const menuButton = screen.getByLabelText('Open navigation menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('opens mobile menu when hamburger is clicked', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      const menuButton = screen.getByLabelText('Open navigation menu');
      fireEvent.click(menuButton);
      
      const closeButton = screen.getByLabelText('Close navigation menu');
      expect(closeButton).toBeInTheDocument();
    });

    it('closes mobile menu when close button is clicked', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      // Open menu
      const menuButton = screen.getByLabelText('Open navigation menu');
      fireEvent.click(menuButton);
      
      // Close menu
      const closeButton = screen.getByLabelText('Close navigation menu');
      fireEvent.click(closeButton);
      
      // Close button should be gone
      expect(screen.queryByLabelText('Close navigation menu')).not.toBeInTheDocument();
    });

    it('has correct navigation aria-label', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      
      const navigation = screen.getByLabelText('Main navigation');
      expect(navigation).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('renders project title', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Header />);
      
      expect(screen.getByText('Görev Kuyruğu')).toBeInTheDocument();
    });

    it('shows breadcrumb on non-home pages', () => {
      mockedUsePathname.mockReturnValue('/tasks');
      render(<Header />);
      
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    it('does not show breadcrumb on home page', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Header />);
      
      // Should only have the title, no breadcrumb
      const titleElements = screen.getAllByText('Görev Kuyruğu');
      expect(titleElements.length).toBe(1);
    });

    it('shows system status indicator', () => {
      mockedUsePathname.mockReturnValue('/');
      render(<Header />);
      
      expect(screen.getByText('System Online')).toBeInTheDocument();
    });
  });
});
