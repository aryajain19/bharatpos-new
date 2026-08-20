import { Tabs } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme, TextInput, Text } from 'react-native-paper';

export default function VendorTabsLayout() {
  const theme = useTheme();
  
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: theme.colors.primary,
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon name="home" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="products" 
        options={{ 
          title: 'Products',
          tabBarIcon: ({ color }) => <Icon name="format-list-bulleted" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="sales" 
        options={{ 
          title: 'Sales',
          tabBarIcon: ({ color }) => <Icon name="receipt" size={24} color={color} />
        }} 
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
